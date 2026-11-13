import { Platform } from 'react-native';

export type PickedPhoto = { blob: Blob; preview: string; width: number; height: number };

/**
 * 웹: 사진 여러 장 고르기 → 긴 변 longEdge px로 줄이고 JPEG로 다시 저장(EXIF 위치정보 제거)
 * → maxBytes 이하가 될 때까지 품질을 낮춘다. 실패한 사진은 건너뛴다.
 */
export function pickPhotos(max = 20, longEdge = 1600, maxBytes = 600_000): Promise<PickedPhoto[]> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return Promise.resolve([]);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []).slice(0, max);
      const out: PickedPhoto[] = [];
      for (const file of files) {
        try {
          const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
          const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(bitmap.width * scale);
          canvas.height = Math.round(bitmap.height * scale);
          canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          let quality = 0.82;
          let blob: Blob | null = null;
          while (quality > 0.3) {
            blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
            if (blob && blob.size <= maxBytes) break;
            quality -= 0.1;
          }
          if (blob && blob.size <= maxBytes) out.push({ blob, preview: URL.createObjectURL(blob), width: canvas.width, height: canvas.height });
        } catch {
          // 읽을 수 없는 파일은 건너뛴다
        }
      }
      resolve(out);
    };
    input.click();
  });
}
