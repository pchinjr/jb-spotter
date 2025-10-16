# Jeff Barr Image Setup Guide

## Finding a Jeff Barr Image

1. **AWS Blog/LinkedIn**: Search for Jeff Barr's official AWS blog posts or LinkedIn profile
2. **AWS Events**: Look for re:Invent speaker photos or AWS event galleries
3. **Professional headshots**: Search for "Jeff Barr AWS headshot" or "Jeff Barr speaker photo"

## Recommended Sources:
- AWS official blog: aws.amazon.com/blogs/aws/author/jbarr/
- LinkedIn: linkedin.com/in/jeffbarr
- AWS events photo galleries

## Processing Your Image

Once you have a Jeff Barr image:

```bash
# Install sharp if not already installed
npm install sharp

# Process your image
node format-jeff-image.js path/to/your/jeff-image.jpg
```

This will create a `jeff-barr.png` file optimized for your app (300x400px, transparent background).

## Upload to S3

After processing, upload to your S3 bucket:
```bash
aws s3 cp jeff-barr.png s3://your-bucket-name/jeff-barr.png
```
