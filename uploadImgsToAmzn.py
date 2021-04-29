import boto3, glob, os
from botocore import errorfactory
import botocore

def globFiles(dirName, ext='png'):
  """Return files matching the given extension in the given directory."""
  return glob.glob(dirName +'/*.%s'%ext)

s3 = boto3.client('s3')
session = boto3.Session(
    aws_access_key_id=os.environ['AWS_SERVER_PUBLIC_KEY'],
    aws_secret_access_key=os.environ['AWS_SERVER_SECRET_KEY']
)
s3_conn = session.client(service_name='s3')
region = 'us-east-2'
bucket_name = 'egg-laying'
try:
    s3_conn.create_bucket(Bucket=bucket_name, CreateBucketConfiguration=
        {'LocationConstraint': region})
except errorfactory.BaseClientExceptions.ClientError as err:
    print('Unable to create bucket:', type(err))
    if 'AlreadyOwned' in str(type(err)):
        print('Bucket already exists; continuing')
    else: exit(1)

globbed_imgs = globFiles('C:/Users/Tracking/coco-annotator/datasets/eggs', ext='jpg')
for imgPath in globbed_imgs[4:]:
    s3_conn.upload_file(imgPath, bucket_name, 'images/{}'.format(os.path.basename(imgPath)))
