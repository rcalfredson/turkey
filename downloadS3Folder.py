import argparse, boto3, glob, os
from botocore import errorfactory
import botocore

def globFiles(dirName, ext='png'):
  """Return files matching the given extension in the given directory."""
  return glob.glob(dirName +'/*.%s'%ext)

def options():
    p = argparse.ArgumentParser(description='Download file from an S3 bucket' +\
      '. Note: environment variables AWS_SERVER_PUBLIC_KEY and ' +\
      'AWS_SERVER_SECRET_KEY must be set in environment for authentication' +\
      'when running script.')
    p.add_argument('bucketName', help='name of bucket containing folder to ' +\
      'download')
    p.add_argument('folderPath', help='path to folder inside bucket to ' +\
      'download')
    return p.parse_args()

s3 = boto3.client('s3')
session = boto3.Session(
  aws_access_key_id=os.environ['AWS_SERVER_PUBLIC_KEY'],
  aws_secret_access_key=os.environ['AWS_SERVER_SECRET_KEY']
)
s3_conn = session.client(service_name='s3')

def downloadDirectoryFroms3(bucketName, remoteDirectoryName):
  s3_resource = boto3.resource('s3',
    aws_access_key_id=os.environ['AWS_SERVER_PUBLIC_KEY'],
    aws_secret_access_key=os.environ['AWS_SERVER_SECRET_KEY'])
  bucket = s3_resource.Bucket(bucketName)
  for obj in bucket.objects.filter(Prefix = remoteDirectoryName):
      safeKey = obj.key.replace(':', ' ')
      if not os.path.exists(os.path.dirname(safeKey)):
          os.makedirs(os.path.dirname(safeKey))
      bucket.download_file(obj.key, safeKey)

opts = options()
downloadDirectoryFroms3(opts.bucketName, opts.folderPath)