from PIL import Image, ImageDraw
import os

src = "../assets/Images/background/Merged"
dest = "../assets/Images/background/Merged/StartScene.png"

# Target dimensions for each image
img_width, img_height = 960, 640

# Width of the blend area at the edges of images (in pixels)
# A value of 0 means no blending. Recommended: 50-100 for visible blending.
blend_width = 50 

# Get all image file names in the source folder
image_files = ["City Night.png", "Desert Night.png", "Field Night.png", "Snow Night.png", "Hills Night (update 3.0).png", "Forest Night.png", "Mysterious Forest Night (update 3.0).png",
               "Mysterious Forest (update 3.0).png", "Forest.png", "Hills Free (update 3.0).png", "Snow.png", "Field.png", "Desert.png"]

if not image_files:
    print("No image files specified.")
    exit()

try:
    # Load images, ensure they are RGBA and keep their original alpha (should be opaque)
    images_orig = [Image.open(os.path.join(src, f)).convert('RGBA').resize((img_width, img_height)) for f in image_files]
except FileNotFoundError as e:
    print(f"Error loading images: {e}. Please check file paths and `src` directory.")
    exit()

if not images_orig:
    print("No images were loaded. Check image_files list and src path.")
    exit()

num_images = len(images_orig)

# Ensure blend_width is not excessively large
if blend_width > img_width: # blend_width can be equal to img_width for full crossfade
    print(f"Warning: blend_width ({blend_width}) is too large for image width ({img_width}). Clamping blend_width.")
    blend_width = img_width 
elif blend_width < 0:
    blend_width = 0


# Calculate total width for the merged image, considering overlap
if num_images == 0:
    total_merged_width = 0
elif num_images == 1:
    total_merged_width = img_width
else:
    total_merged_width = img_width + (num_images - 1) * (img_width - blend_width)
    if total_merged_width < img_width: # Safety check
        total_merged_width = img_width

if total_merged_width <= 0:
    print("Calculated merged width is zero or negative. Cannot create image.")
    exit()
    
merged_img = Image.new('RGBA', (total_merged_width, img_height), (0,0,0,0)) # Start with a transparent background

# Create a reusable gradient mask for blending (if blend_width > 0)
gradient_mask = None
if blend_width > 0 and num_images > 1:
    gradient_mask = Image.new('L', (blend_width, img_height))
    draw_mask = ImageDraw.Draw(gradient_mask)
    for x_coord in range(blend_width):
        # Opacity for the mask: 0 means use background, 255 means use foreground
        # This gradient goes from 0 (transparent for new image) to 255 (opaque for new image)
        if blend_width == 1:
            opacity = 128 # Mid-point for single pixel blend
        else:
            opacity = int((x_coord / float(blend_width - 1)) * 255)
        draw_mask.line([(x_coord, 0), (x_coord, img_height - 1)], fill=opacity)

current_paste_x = 0 # Tracks the x-coordinate in merged_img for the start of the non-overlapping part of the current image

for i, img_to_add in enumerate(images_orig):
    if i == 0:
        # Paste the first image directly
        merged_img.paste(img_to_add, (current_paste_x, 0))
        current_paste_x += img_width
    else:
        # For subsequent images, the actual paste starts 'blend_width' pixels into the previous image's area
        effective_paste_start_x = current_paste_x - blend_width

        if blend_width > 0 and gradient_mask:
            # Crop the strip from the existing merged image (background for composite)
            strip_from_merged = merged_img.crop((effective_paste_start_x, 0, effective_paste_start_x + blend_width, img_height))
            
            # Crop the strip from the new image to be added (foreground for composite)
            strip_from_new_img = img_to_add.crop((0, 0, blend_width, img_height))

            # Blend using Image.composite:
            # image1 (strip_from_new_img) is used where mask is 255
            # image2 (strip_from_merged) is used where mask is 0
            # Our gradient_mask goes 0 to 255, so it fades in strip_from_new_img over strip_from_merged
            blended_strip = Image.composite(strip_from_new_img, strip_from_merged, gradient_mask)
            merged_img.paste(blended_strip, (effective_paste_start_x, 0))

            # Paste the remaining (non-blended) part of the new image
            # This part starts after the blend_width on the new image
            # and is pasted after the blended_strip in the merged_img
            if img_width > blend_width: # Ensure there's a non-blended part
                rest_of_new_img = img_to_add.crop((blend_width, 0, img_width, img_height))
                merged_img.paste(rest_of_new_img, (effective_paste_start_x + blend_width, 0))
            
            current_paste_x = effective_paste_start_x + img_width
        else:
            # No blending, just paste (potentially overlapping if blend_width was intended)
            merged_img.paste(img_to_add, (effective_paste_start_x, 0))
            current_paste_x = effective_paste_start_x + img_width

# Save the result
os.makedirs(os.path.dirname(dest), exist_ok=True)
merged_img.save(dest)
print(f"Merged image with color blending saved to {dest}")