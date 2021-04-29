import glob, os

def globFiles(dirName, ext='png'):
  """Return files matching the given extension in the given directory."""
  return glob.glob(dirName +'/*.%s'%ext)

globbed_imgs = globFiles('C:/Users/Tracking/coco-annotator/datasets/eggs', ext='jpg')
print('how many globbed images?', globbed_imgs)
print(len(globbed_imgs))
input()
with open('manifest.jl', 'w') as f:
    for img in globbed_imgs:
        f.write('{{"source-ref":"s3://egg-laying/images/{}"}}\n'.format(os.path.basename(img)))