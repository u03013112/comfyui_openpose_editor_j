from PIL import Image
import os
import folder_paths
import hashlib
import torch
import numpy as np

class OpenPoseEditorJ:
  @classmethod
  def INPUT_TYPES(self):
    temp_dir = folder_paths.get_temp_directory()

    if not os.path.isdir(temp_dir):
      os.makedirs(temp_dir)

    temp_dir = folder_paths.get_temp_directory()

    return {"required":
              {"image": (sorted(os.listdir(temp_dir)),)},
            }

  RETURN_TYPES = ("IMAGE",)
  FUNCTION = "output_pose"

  CATEGORY = "image"

  def output_pose(self, image):
    image_path = os.path.join(folder_paths.get_temp_directory(), image)

    i = Image.open(image_path)
    image = i.convert("RGB")
    image = np.array(image).astype(np.float32) / 255.0
    image = torch.from_numpy(image)[None,]

    return (image,)



NODE_CLASS_MAPPINGS = {
    "OpenPose.Editor.Plus.J": OpenPoseEditorJ
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "OpenPose.Editor.Plus.J": "OpenPose Editor Plus J",
}