const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Uploads a single file buffer to AWS S3.
 */
const uploadFileToS3 = async ({ awsBuckName, key, body, contentType }, s3Client) => {
  const params = {
    Bucket: awsBuckName,
    Key: key,
    Body: body,
    ContentType: contentType,
  };
  const command = new PutObjectCommand(params);
  await s3Client.send(command);
};

/**
 * Extracts file paths (keys) from S3 URLs.
 */
const extractFilePathsFromS3Urls = (urls) => {
  return urls.map((url) => {
    try {
      return new URL(url).pathname.slice(1);
    } catch {
      return null;
    }
  }).filter(Boolean);
};

/**
 * Deletes multiple objects from an AWS S3 bucket.
 */
const deleteS3Objects = async (keys, bucketName, s3Client) => {
  if (!Array.isArray(keys) || keys.length === 0) return;

  await Promise.all(
    keys.map(async (key) => {
      const params = {
        Bucket: bucketName,
        Key: key,
      };
      const command = new DeleteObjectCommand(params);
      await s3Client.send(command);
    })
  );
};

module.exports = {
  uploadFileToS3,
  extractFilePathsFromS3Urls,
  deleteS3Objects,
};
