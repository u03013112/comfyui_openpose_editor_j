import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
from nodes import LoadImage

class JImagePreviewNode:
    def __init__(self):
        pass
    
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required":
                {
                    "image": ("STRING", { "default": "" })
                },
            }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "load_image"
    CATEGORY = "J Image Processing"

    def load_image(self, image):
        image, mask = LoadImage.load_image(self, image)
        return (image,)

    

# 注册节点
NODE_CLASS_MAPPINGS = {
    "JImagePreviewNode": JImagePreviewNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "JImagePreviewNode": "Image Preview Node"
}
