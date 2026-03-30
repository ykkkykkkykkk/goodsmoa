const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * multer 메모리 버퍼를 Cloudinary에 업로드
 * @param {Buffer} buffer - 파일 버퍼
 * @param {string} folder - Cloudinary 폴더명
 * @returns {Promise<string>} 업로드된 이미지 URL
 */
function uploadToCloudinary(buffer, folder = 'goodsmoa') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        format: 'webp',
        quality: 'auto',
        transformation: [{ width: 1200, crop: 'limit' }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}

/**
 * Cloudinary에 업로드 + 썸네일 URL 생성
 * @param {Buffer} buffer
 * @returns {Promise<{imageUrl: string, thumbnailUrl: string}>}
 */
async function uploadWithThumbnail(buffer) {
  const imageUrl = await uploadToCloudinary(buffer, 'goodsmoa/trades');
  // Cloudinary URL 변환으로 썸네일 생성 (리사이즈)
  const thumbnailUrl = imageUrl.replace('/upload/', '/upload/w_400,h_400,c_fit,q_75/');
  return { imageUrl, thumbnailUrl };
}

module.exports = { uploadToCloudinary, uploadWithThumbnail };
