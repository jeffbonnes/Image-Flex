const AWS = require('aws-sdk')
const Sharp = require('sharp')
const { parse } = require('querystring')

const S3 = new AWS.S3()

const DAYS_TO_CACHE = 60 * 60 * 24 * 365; // 365 Days

const GetOrCreateImage = async event => {
  const {
    cf: {
      request: {
        origin: {
          s3: {
            domainName
          }
        },
        querystring,
        uri
      },
      response,
      response: {
        status
      }
    }
  } = event.Records[0]

  if (!['403', '404'].includes(status)) return {...response,
    headers: {
      ...response.headers,
      'cache-control': [{key: 'Cache-Control', value: `public, max-age=${DAYS_TO_CACHE}` }]
    }
  };

  let { nextExtension, height, sourceImage, width } = parse(querystring)
  const [bucket] = domainName.match(/.+(?=\.s3\.amazonaws\.com)/i)
  const contentType = 'image/' + nextExtension
  const key = uri.replace(/^\//, '')
  const sourceKey = sourceImage.replace(/^\//, '')

  height = parseInt(height, 10) || null
  width = parseInt(width, 10)

  if (!width) return {...response,
    headers: {
      ...response.headers,
      'cache-control': [{key: 'Cache-Control', value: `public, max-age=${DAYS_TO_CACHE}` }]
    }
  };

  return S3.getObject({ Bucket: bucket, Key: sourceKey })
    .promise()
    .then(imageObj => {
      let resizedImage
      const errorMessage = `Error while resizing "${sourceKey}" to "${key}":`

      // Required try/catch because Sharp.catch() doesn't seem to actually catch anything. 
      try {
        resizedImage = Sharp(imageObj.Body)
          .resize(width, height)
          .toFormat(nextExtension, {
            /**
             * @see https://sharp.pixelplumbing.com/api-output#webp for a list of options.
             */
            quality: 80
          })
          .toBuffer()
          .catch(error => {
            throw new Error(`${errorMessage} ${error}`)
          })
      } catch(error) {
        throw new Error(`${errorMessage} ${error}`)
      }
      return resizedImage
    })
    .then(async imageBuffer => {
      await S3.putObject({
        Body: imageBuffer,
        Bucket: bucket,
        ContentType: contentType,
        Key: key,
        StorageClass: 'STANDARD'
      })
        .promise()
        .catch(error => {
          throw new Error(`Error while putting resized image '${uri}' into bucket: ${error}`)
        })

      return {
        ...response,
        status: 200,
        statusDescription: 'Found',
        body: imageBuffer.toString('base64'),
        bodyEncoding: 'base64',
        headers: {
          ...response.headers,
          'content-type': [{ key: 'Content-Type', value: contentType }],
          'cache-control': [{key: 'Cache-Control', value: `public, max-age=${DAYS_TO_CACHE}` }]
        }
      }
    })
    .catch(error => {
      const errorMessage = `Error while getting source image object "${sourceKey}": ${error}`

      return {
        ...response,
        status: 404,
        statusDescription: 'Not Found',
        body: errorMessage,
        bodyEncoding: 'text',
        headers: {
          ...response.headers,
          'content-type': [{ key: 'Content-Type', value: 'text/plain' }]
        }
      }
    })
}

module.exports = GetOrCreateImage
