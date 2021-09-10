import cv2
import json

img_path = (
    r"P:\Robert\splineDist\data\egg\predictions"
    r"_for_seg_tool\9_11_2020_img_0008_1_1.jpg"
)
outline_path = (
    r"P:\Robert\splineDist\data\egg\predictions"
    r"_for_seg_tool\9_11_2020_img_0008_1_1_outlines.json"
)

img = cv2.resize(cv2.imread(img_path), (0, 0), fx=4, fy=4)
with open(outline_path) as f:
    outline_data = json.load(f)

for egg in outline_data:
    print('egg:', egg)
    for pt in egg:
        print('pt:', pt)
        cv2.drawMarker(img, tuple(reversed([round(coord*4) for coord in pt])),
        (255, 0, 0), cv2.MARKER_STAR, markerSize = 2)

cv2.imshow("debug", img)
cv2.waitKey(0)