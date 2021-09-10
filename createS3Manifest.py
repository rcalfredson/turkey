import argparse, glob, os

p = argparse.ArgumentParser(
    description="create jsonlines manifest file for a directory of images"
)

p.add_argument("path", help="path of folder containing images for the manifest.")


def globFiles(dirName, ext="png"):
    """Return files matching the given extension in the given directory."""
    return glob.glob(dirName + "/*.%s" % ext)


opts = p.parse_args()
globbed_imgs = globFiles(opts.path, ext="jpg")
print("how many globbed images?", globbed_imgs)
print(len(globbed_imgs))
input()
with open("manifest.jsonl", "w") as f:
    for img in globbed_imgs:
        f.write(
            '{{"source-ref":"s3://egg-laying/images/{}"}}\n'.format(
                os.path.basename(img)
            )
        )
