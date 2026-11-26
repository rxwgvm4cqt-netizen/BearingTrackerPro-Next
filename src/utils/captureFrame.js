const OCR_OUTPUT_WIDTH = 520;
const OCR_ROI = { height: 0.32, left: 0.18, top: 0.34, width: 0.64 };
export function captureFrameForOCR(videoElement, canvasElement, t) {
  if (!videoElement || !canvasElement) {
    throw new Error(t("ocrSourceMissing"));
  }

  const sourceVideoWidth = videoElement.videoWidth;
  const sourceVideoHeight = videoElement.videoHeight;
  const previewWidth = videoElement.clientWidth;
  const previewHeight = videoElement.clientHeight;

  if (
    !sourceVideoWidth ||
    !sourceVideoHeight ||
    !previewWidth ||
    !previewHeight
  ) {
    throw new Error(t("ocrSourceNotReady"));
  }

  const coverScale = Math.max(
    previewWidth / sourceVideoWidth,
    previewHeight / sourceVideoHeight,
  );
  const renderedVideoWidth = sourceVideoWidth * coverScale;
  const renderedVideoHeight = sourceVideoHeight * coverScale;
  const hiddenVideoX = (renderedVideoWidth - previewWidth) / 2;
  const hiddenVideoY = (renderedVideoHeight - previewHeight) / 2;
  const roiPreviewX = OCR_ROI.left * previewWidth;
  const roiPreviewY = OCR_ROI.top * previewHeight;
  const roiPreviewWidth = OCR_ROI.width * previewWidth;
  const roiPreviewHeight = OCR_ROI.height * previewHeight;
  const sourceX = Math.max(0, (roiPreviewX + hiddenVideoX) / coverScale);
  const sourceY = Math.max(0, (roiPreviewY + hiddenVideoY) / coverScale);
  const sourceWidth = Math.min(
    sourceVideoWidth - sourceX,
    roiPreviewWidth / coverScale,
  );
  const sourceHeight = Math.min(
    sourceVideoHeight - sourceY,
    roiPreviewHeight / coverScale,
  );

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error(t("ocrZoneOutside"));
  }

  const outputScale = OCR_OUTPUT_WIDTH / sourceWidth;
  const outputWidth = Math.round(sourceWidth * outputScale);
  const outputHeight = Math.round(sourceHeight * outputScale);

  canvasElement.width = outputWidth;
  canvasElement.height = outputHeight;

  const context = canvasElement.getContext("2d", { willReadFrequently: true });
  context.drawImage(
    videoElement,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  const imageData = context.getImageData(0, 0, outputWidth, outputHeight);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance =
      pixels[index] * 0.299 +
      pixels[index + 1] * 0.587 +
      pixels[index + 2] * 0.114;
    const contrasted = (luminance - 128) * 1.7 + 128;
    const threshold = contrasted > 150 ? 255 : 0;

    pixels[index] = threshold;
    pixels[index + 1] = threshold;
    pixels[index + 2] = threshold;
  }

  context.putImageData(imageData, 0, 0);

  return canvasElement;
}
