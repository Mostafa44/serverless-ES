import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import 'source-map-support/register'
import * as AWS from 'aws-sdk'
import * as uuid from 'uuid'

const docClient = new AWS.DynamoDB.DocumentClient()

const s3 = new AWS.S3({
  signatureVersion: 'v4'
})

const groupsTable = process.env.GROUPS_TABLE
const imagesTable = process.env.IMAGES_TABLE
const bucketName = process.env.IMAGES_S3_BUCKET
const urlExpiration = process.env.SIGNED_URL_EXPIRATION

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Caller event', event)
  const groupId = event.pathParameters.groupId
  const validGroupId = await groupExists(groupId)

  if (!validGroupId) {
    return {
      statusCode: 404,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Group does not exist'
      })
    }
  }

  // TODO: Create an image
  console.log('Processing event: ', event)
  //const itemId = uuid.v4()

  const newImage = JSON.parse(event.body)

  const imageId = uuid.v4()
  const newItem = {
    groupId,
    timestamp: Date.now().toString(),
    imageId,
    ...newImage,
    imageUrl: `https://${bucketName}.s3.amazonaws.com/${imageId}`
  }
  const url = getUploadUrl(imageId);

  await docClient.put({
    TableName: imagesTable,
    Item: newItem
  }).promise()

  return {
    statusCode: 201,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      newItem,
      uploadUrl: url
    })
  }
}

async function groupExists(groupId: string) {
  const result = await docClient
    .get({
      TableName: groupsTable,
      Key: {
        id: groupId
      }
    })
    .promise()

  console.log('Get group: ', result)
  return !!result.Item
}

const getUploadUrl = (imageId: string) => {
  return s3.getSignedUrl('putObject', {
    Bucket: bucketName,
    Key: imageId,
    Expires: urlExpiration
  })
}
