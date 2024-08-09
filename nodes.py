from PIL import Image
import os
import folder_paths
import hashlib
import torch
import numpy as np

g_npImage = None

import base64
from io import BytesIO
from server import PromptServer
from aiohttp import web
routes = PromptServer.instance.routes
@routes.post('/upload_to_j')
async def my_function(request):
    data = await request.post()
    # print('my_function:',data)
    
    base64_image = data['image']

    # 解码 Base64 图像
    image_data = base64.b64decode(base64_image.split(',')[1])
    image = Image.open(BytesIO(image_data))

    # 将图像转换为 NumPy 数组
    numpy_array = np.array(image)
    # # 确保图像模式为 RGB
    # if image.mode != 'RGB':
    #     image = image.convert('RGB')

    # print(image.mode)
    # print(numpy_array)

    # 归一化处理，将颜色值从 [0, 255] 范围转换到 [0, 1] 范围
    normalized_array = numpy_array / 255.0

    global g_npImage

    g_npImage = normalized_array

    return web.json_response({})


class OpenPoseEditorJ:
  @classmethod
  def INPUT_TYPES(self):
    temp_dir = folder_paths.get_temp_directory()

    if not os.path.isdir(temp_dir):
      os.makedirs(temp_dir)

    temp_dir = folder_paths.get_temp_directory()

    return {
        "required":{
            # "image": (sorted(os.listdir(temp_dir)),)
        },
            }

  RETURN_TYPES = ("IMAGE",)
  FUNCTION = "output_pose"

  CATEGORY = "image"

  @classmethod
  def IS_CHANGED(self):
    return float("NaN")
       
  def output_pose(self):
    global g_npImage
    if g_npImage is not None:
        image = g_npImage
    else:
        image = np.random.rand(256, 256, 3).astype(np.float32)

    image = torch.from_numpy(image)[None,]

    return (image,)


NODE_CLASS_MAPPINGS = {
    "OpenPose.Editor.Plus.J": OpenPoseEditorJ
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "OpenPose.Editor.Plus.J": "OpenPose Editor Plus J",
}