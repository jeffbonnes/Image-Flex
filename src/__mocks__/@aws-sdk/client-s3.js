const mockImage = 'image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAQAAACRI2S5AAAAEElEQVR42mNkIAAYRxWAAQAG9gAKqv6+AwAAAABJRU5ErkJggg=='
const validObjectKey = 'good-image.jpg'

const mockS3Client = {
  send: jest.fn(async (command) => {
    if (command.constructor.name === 'GetObjectCommand') {
      if (command.Key !== validObjectKey) {
        throw new Error()
      }
      return {
        Body: mockImage,
        ContentType: 'image/jpeg'
      }
    }
    if (command.constructor.name === 'PutObjectCommand') {
      return {
        Payload: '{"success": true}'
      }
    }
    return {}
  })
}

exports.S3Client = jest.fn(() => mockS3Client)
exports.GetObjectCommand = jest.fn((params) => ({ ...params, constructor: { name: 'GetObjectCommand' } }))
exports.PutObjectCommand = jest.fn((params) => ({ ...params, constructor: { name: 'PutObjectCommand' } }))
