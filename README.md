![demo_pic](https://i.imgur.com/jXAmiGw.jpg)
![demo_pic](https://i.imgur.com/EngUbGJ.jpg)

# **paper-turkey**: an instance segmentation labeler using Paper.js 

Author: Robert Alfredson (robert.c.alfredson@gmail.com)

Adapted from the [`turkey`](https://github.com/yanfengliu/turkey) project, authored by: 
* Yanfeng Liu (yanfengliux@gmail.com)
* Jay Carlson (jcarlson@unl.edu)

**paper-turkey** lets you easily create a web UI on Amazon Mechanical Turk to crowd-source image annotation data. Its main functions include:
* Brush tool with adjustable radius
* Customize the class labels on per-instance basis
* Zoom-in, zoom-out, delete, reset

**turkey** is written in plain JavaScript, with a little help from jQuery and bootstrap. Feel free to fork it and adapt it to your needs. You can also file an issue or pull request, because this repo is being actively maintained.

Please note that **turkey is only fully tested on Chrome**. Development is still in progress. Ideas and suggestions are welcome!

## Configuring Amazon Turk to use turkey

- Create a custom HIT in the Amazon Turk Requester
- Copy the contents of `Mturk.html` into the source code section
- After the HIT is created, simply **Publish Batch** with a CSV file of both image URIs and annotation modes that you provide. 
  - Optionally, you can also import previous annotations by putting the correctly formatted json string into column "annotations". 
  - Please note that the `annotations` column is meant to be JSON string, but to get around CSV formatting, we use `;` instead of `,` and single quote `'` instead of double quote `"`. This can be programmtically processed to be normal JSON in pre/post-processing. A sample CSV file may look like:

```
img_url,annotation_mode,classes,annotations
https://i.imgur.com/kcCSGTR.jpg,dot-polygon-bbox-link,person-dog-house,"[{'class':'house';'mode':'polygon';'data':[[85;450];[41;524];[96;581];[163;531]]};{'class':'dog';'mode':'polygon';'data':[[246;461];[203;489];[268;500]]}]"
https://i.imgur.com/2yOma1u.jpg,polygon,cat-person-sky-food,"[{'class':'cat';'mode':'polygon';'data':[[543,498];[534,524];[533;563];[542;578];[555;572];[559;559]]}]"
https://i.imgur.com/5PiDyYf.jpeg,bbox-polygon,house-ground
```

The first item in the `annotation_mode` and `classes` will be used as default option. 

Here, for each image, we treat it differently. 
- For the first image, we allow 4 annotation modes, 3 class labels, and import previous annotations; 
- For the second image, we allow 1 annotation mode (polygon), 4 class labels, and import previous annotations; 
- For the third image, we allow 2 annotation modes, 2 class labels, and start fresh with no previous annotation.

Alternatively, we can also treat a batch of images with the same settings by copy-pasting the `annotation_mode` and `classes` columns programmatically (or by hand if it is practical). The choice is yours!

## Testing without Turk
You can test the code before deploying it on MTurk by opening `localDemo.html` in your browser. This file is a lightweight wrapper that will load `MTurk.html` off GitHub, passing a sample image to it in the process. If you don't see anything here, make sure to start Chrome with the `--allow-file-access-from-files` flag (or the equivalent configuration for the browser of your choice). This will allow this wrapper page to load MTurk.html.

 Alternatively, if you have NPM installed, you can run the following commands from the terminal and open `localDemo.html` from the localhost page:
 ```
 npm install -g serve && serve
 ```

## Unpacking data from .csv file
After the users annotate the images, Amazon Mechanical Turk provides a `.csv` file ready for downloading. `reviewAnnotations.m` contains a sample MATLAB UI that displays the downloaded annotations for review. The approval results will be written into a csv file to be uploaded to MTurk for batch processing. The MATLAB UI is shown below:

![demo_pic](https://i.imgur.com/Ce5WcZ3.jpg)
![demo_pic](https://i.imgur.com/678GVaj.png)
