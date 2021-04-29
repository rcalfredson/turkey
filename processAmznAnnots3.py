import argparse
import base64
import glob
import io
import json
import os
import random
import pycocotools
import cv2
import imageio
from PIL import Image, ImageColor, ImageDraw
import numpy as np
import visvis as vv
from pycocotools import mask
from skimage import measure

CAT_TO_ID = dict(egg=1, blob=2)
CAT_TO_COLOR = dict(egg='#f00562', blob='#d63526')
def r(): return random.randint(0, 255)


def options():
    p = argparse.ArgumentParser(description='Convert Amazon SageMaker ' +
                                'instance segmentation data to COCO format')
    p.add_argument('annotDir', metavar='path/to/annots', help='path to the ' +
                   'directory containing the raw annotation data from Amazon')
    p.add_argument('manifest', metavar='path/to/manifest', help='path to ' +
                   'the manifest file associated with the labelling job')
    p.add_argument('imgsDir', metavar='path/to/imgs', help='path to the ' +
                   'directory containing all possible training/eval images')
    return p.parse_args()


opts = options()

alphabetizedImgList = [imgPath for imgPath in sorted(
    glob.glob(os.path.join(opts.imgsDir, '*.jpg')))]
alphabetizedImgListBaseNames = [os.path.basename(
    imgPath) for imgPath in alphabetizedImgList]
cocoOutput = dict(annotations=[], categories=[], images=[])

jsonAnnots = glob.glob(os.path.join(opts.annotDir, "*.json"))
with open(opts.manifest) as f:
    labelledImgs = [os.path.basename(json.loads(imgLine)['source-ref']) for
                    imgLine in f.readlines()]
instance_id = 0
for jsonFile in jsonAnnots:
    with open(jsonFile) as f:
        jsonData = json.load(f)
        taskName = list(
            jsonData[0]['consolidatedAnnotation']['content'].keys())[0]
        imgName = labelledImgs[int(jsonData[0]['datasetObjectId'])]
        imgId = alphabetizedImgListBaseNames.index(imgName)
        annotationData = json.loads(json.loads(jsonData[0]['consolidatedAnnotation'][
            'content'][taskName]['annotationsFromAllWorkers'][0]['annotationData'][
            'content'])['annotations'])
        if len(cocoOutput['categories']) == 0:
            label = annotationData[0]['class']
            cocoOutput['categories'].append({'id': CAT_TO_ID[label],
                                             'name': label, 'supercategory': "", 'color': CAT_TO_COLOR[label],
                                             'metadata': {}, 'keypoint_colors': []})
            img = cv2.imread(alphabetizedImgList[imgId])
        # img = imageio.imread(io.BytesIO(base64.b64decode(annotationData[
            # 'labeledImage']['pngImageData'])))
        # cv2_img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
#     # cv2.imshow('testing', cv2_img)
#     # cv2.waitKey(0)
        imageData = {'id': imgId, 'path': alphabetizedImgList[imgId],
                     'height': img.shape[0], 'width': img.shape[1], 'file_name': imgName,
                     'annotated': False, 'annotating': [], 'num_annotations': 0,
                     'metadata': {}, 'deleted': False, 'milliseconds': 0, 'events': [],
                     'regenerate_thumbnail': False}
        cocoOutput['images'].append(imageData)
        for i, instance in enumerate(annotationData):
            runningArea = 0
            # polygonPts = np.multiply(np.asarray(instance['data']).flatten(), img.shape[1] / 1200)
            # polygonPts = np.multiply(np.asarray([[4, 3, 1, 5], [7, 4, 5, 3]]).flatten(), img.shape[1] / 1200)
            # polygonPts = np.multiply(np.asarray([[int(el) for el in annot[
            # 'segmentation'][0]]))
            polygonPts = np.multiply(np.asarray(
                np.asarray(instance['points'])), img.shape[1] / 1200)
            blankImg = Image.new("L", tuple(reversed(img.shape[0:2])), 0)
            for j, seg in enumerate(polygonPts):
                if j == 0:
                    ImageDraw.Draw(blankImg).polygon([int(el)
                                                      for el in seg], outline=1, fill=1)
                    fortran_ground_truth_binary_mask = np.asfortranarray(
                        blankImg)
                    encoded_ground_truth = mask.encode(
                        fortran_ground_truth_binary_mask)
                    runningArea += mask.area(encoded_ground_truth)
                    ground_truth_bounding_box = mask.toBbox(
                        encoded_ground_truth)
                else:
                    ImageDraw.Draw(blankImg).polygon([int(el)
                                                      for el in seg], outline=i, fill=i)
                    fortran_ground_truth_binary_mask = np.asfortranarray(
                        blankImg)
                    encoded_ground_truth = mask.encode(
                        fortran_ground_truth_binary_mask)
                    runningArea -= mask.area(encoded_ground_truth)
            annotation = {
                "segmentation": [],
                "metadata": {},
                "area": runningArea.tolist(),
                "iscrowd": False,
                "isbbox": False,
                "image_id": imgId,
                "bbox": ground_truth_bounding_box.tolist(),
                "category_id": CAT_TO_ID[instance['class']],
                "id": instance_id,
                "color": '#{:02x}{:02x}{:02x}'.format(r(), r(), r())
            }
            instance_id += 1
            for seg in polygonPts:
              annotation['segmentation'].append(seg.tolist())

#       for contour in contours:
#           contour = np.flip(contour, axis=1)
#           segmentation = contour.ravel().tolist()
#           annotation["segmentation"].append(segmentation)
            # how many levels of nesting are correct?
            # only two because each instance can have one or more segmentations
            # why are there three levels now?
            cocoOutput['annotations'].append(annotation)

#       # blankImg = Image.new("L", tuple(reversed(img.shape[0:2])), 0)
#       # ImageDraw.Draw(blankImg).polygon([int(el) for el in annotation[
#       #   'segmentation'][0]], outline=1, fill=1)
#       # reconstructedMask = np.array(blankImg)
#       # cv2.imshow('reconstructedMask', 255*reconstructedMask)
#       # cv2.waitKey(0)

with open('%s_labels_fromAmzn_%s.json' % (label, taskName), 'w') as f:
    json.dump(cocoOutput, f, ensure_ascii=False, indent=4)
