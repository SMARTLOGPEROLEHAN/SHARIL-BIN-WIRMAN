/**
 * Utility to optimize images client-side before uploading.
 * It resizes images proportionally to a specified maximum width/height
 * and compresses them using WebP or JPEG format.
 */
export const optimizeImage = (file: File, maxWidth = 1600, maxHeight = 1600, quality = 0.75): Promise<File> => {
  return new Promise((resolve, reject) => {
    // If it's not an image, resolve immediately with the original file
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const originalWidth = img.width;
        const originalHeight = img.height;
        const SIZE_LIMIT = 2 * 1024 * 1024; // 2MB Limit

        const attemptCompression = (w: number, h: number, q: number, currentMaxWidth: number, currentMaxHeight: number, attemptCount: number) => {
          let width = w;
          let height = h;

          // Calculate proportional scale dimensions
          if (width > currentMaxWidth || height > currentMaxHeight) {
            if (width > height) {
              height = Math.round((height * currentMaxWidth) / width);
              width = currentMaxWidth;
            } else {
              width = Math.round((width * currentMaxHeight) / height);
              height = currentMaxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve(file);
            return;
          }

          // Draw image onto canvas
          ctx.drawImage(img, 0, 0, width, height);

          // Determine target format. WebP is highly preferred for size optimization.
          const outputType = 'image/webp';
          
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }

              // If the optimized blob is larger than the original image file (which can happen
              // for already-tiny files), and the original is already under the 2MB limit, we keep original.
              if (blob.size >= file.size && file.size <= SIZE_LIMIT) {
                resolve(file);
                return;
              }

              // Construct new file path / naming with optimized extension
              let newName = file.name;
              const lastDotIndex = newName.lastIndexOf('.');
              if (lastDotIndex !== -1) {
                newName = newName.substring(0, lastDotIndex) + '.webp';
              } else {
                newName = newName + '.webp';
              }

              const optimizedFile = new File([blob], newName, {
                type: outputType,
                lastModified: Date.now(),
              });

              // If file is still exceeding 2MB and we haven't hit maximum recursive bounds
              if (optimizedFile.size > SIZE_LIMIT && attemptCount < 10) {
                // Gradually step down the resolution limit and the compression quality
                const nextMaxWidth = Math.max(300, Math.round(currentMaxWidth * 0.75));
                const nextMaxHeight = Math.max(300, Math.round(currentMaxHeight * 0.75));
                const nextQuality = Math.max(0.1, q * 0.7);

                // Recursively repeat with smaller properties
                attemptCompression(originalWidth, originalHeight, nextQuality, nextMaxWidth, nextMaxHeight, attemptCount + 1);
              } else {
                // Under 2MB limit or reached maximum retry budget
                resolve(optimizedFile);
              }
            },
            outputType,
            q
          );
        };

        // Start compression chain
        attemptCompression(originalWidth, originalHeight, quality, maxWidth, maxHeight, 1);
      };

      img.onerror = (err) => {
        reject(err);
      };
    };

    reader.onerror = (err) => {
      reject(err);
    };
  });
};
