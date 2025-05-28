from PIL import Image

dest = "../assets/Images/background"

def merge_images(image_count: int, base_addr: str, output_name: str):
    """
    Merges a list of images into a single image.
    
    :param image_count: Number of images to be merged.
    :param base_addr: Base address where images are stored.
    :param output_name: Name of the output image file.
    :return: Merged image.
    """
    if image_count == 0:
        return None

    width, height = 960, 640

    # Create a new blank image with the same dimensions
    base_name = input("Enter the base name for the images (e.g., 'image'): ")
    base = Image.open(f"{dest}/{base_addr}/{base_name} 01.png").convert("RGBA").resize((width, height))

    # Paste each image onto the merged image
    for i in range(image_count-1):
        img_number = str(i + 2).zfill(2)  # Ensure the image number is two digits
        img_path = f"{dest}/{base_addr}/{base_name} {img_number}.png"
        img = Image.open(img_path).convert("RGBA").resize((width, height))
        base.alpha_composite(img)

    base.save(f"{dest}/Merged/{output_name}.png")

image_count = int(input("Enter the number of images to merge: "))
base_addr = input("Enter the base address of the images: ")
output_name = input("Enter the name for the output image: ")

merge_images(image_count, base_addr, output_name)