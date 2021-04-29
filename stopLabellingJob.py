import argparse, boto3, glob, os
from botocore import errorfactory
import botocore

session = boto3.Session(
  aws_access_key_id=os.environ['AWS_SERVER_PUBLIC_KEY'],
  aws_secret_access_key=os.environ['AWS_SERVER_SECRET_KEY']
)
sagemaker_conn = session.client(service_name='sagemaker', region_name='us-east-2')
sagemaker_conn.stop_labeling_job(LabelingJobName='turkey-test-2')
