# Hướng Dẫn Tích Hợp Cloudflare R2

## Tổng Quan
Dự án đã được chuẩn bị sẵn để tích hợp với Cloudflare R2 cho lưu trữ ảnh/video. R2 cung cấp:
- **Chi phí thấp hơn**: Không tính phí bandwidth egress
- **Tốc độ nhanh**: Tích hợp CDN Cloudflare
- **S3-compatible**: Dùng AWS SDK

## Cấu Trúc Đã Tạo

### 1. Edge Functions

#### `supabase/functions/r2-upload/index.ts`
- Upload files lên R2 bucket
- Sử dụng AWS S3 SDK
- Tự động generate unique filenames
- Trả về public URL

#### `supabase/functions/r2-get-url/index.ts`
- Generate public URLs cho files đã upload
- Hỗ trợ signed URLs (cần config thêm)

### 2. Utility Functions

#### `src/utils/r2Storage.ts`
```typescript
// Upload file
import { uploadToR2 } from '@/utils/r2Storage';
const result = await uploadToR2(file, 'image');
console.log(result.publicUrl); // URL để hiển thị

// Get URL từ filename
import { getR2Url } from '@/utils/r2Storage';
const url = await getR2Url(fileName);
```

### 3. Secrets Đã Configure
- `R2_ACCOUNT_ID`: Account ID của Cloudflare
- `R2_ACCESS_KEY_ID`: API Access Key
- `R2_SECRET_ACCESS_KEY`: API Secret Key
- `R2_BUCKET_NAME`: Tên bucket R2

## Các Bước Thiết Lập

### Bước 1: Tạo R2 Bucket trong Cloudflare

1. Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Chọn **R2** từ sidebar
3. Click **Create bucket**
4. Đặt tên bucket (ví dụ: `my-app-media`)
5. Chọn region (thường là `auto`)

### Bước 2: Tạo API Token

1. Trong R2, click **Manage R2 API Tokens**
2. Click **Create API Token**
3. Chọn permissions: **Object Read & Write**
4. Copy thông tin:
   - Access Key ID
   - Secret Access Key
   - Account ID (trong URL hoặc Overview page)

### Bước 3: Configure Public Access

Có 2 cách để làm files public:

#### Option A: Custom Domain (Khuyến Nghị)
1. Trong bucket settings, click **Settings**
2. Tìm **Public access** section
3. Click **Connect Domain**
4. Thêm subdomain (ví dụ: `media.yourdomain.com`)
5. Follow DNS setup instructions
6. Update URL format trong code:
```typescript
// Trong supabase/functions/r2-upload/index.ts
const publicUrl = `https://media.yourdomain.com/${fileName}`;
```

#### Option B: R2.dev Domain
1. Enable **Public Access** trong bucket settings
2. Sử dụng domain mặc định: `https://<bucket-name>.<account-id>.r2.dev`

### Bước 4: Cập Nhật Code Upload

Để sử dụng R2 thay vì Supabase Storage, bạn cần update các file sau:

#### `src/components/feed/CreatePost.tsx`
```typescript
// Thay đổi từ Supabase Storage:
const { error } = await supabase.storage.from('posts').upload(fileName, image);

// Sang R2:
import { uploadToR2 } from '@/utils/r2Storage';
const result = await uploadToR2(image, 'image');
const imageUrl = result.publicUrl;
```

#### `src/components/feed/EditPostDialog.tsx`
```typescript
// Tương tự như CreatePost
import { uploadToR2 } from '@/utils/r2Storage';
const result = await uploadToR2(imageFile, 'image');
const finalImageUrl = result.publicUrl;
```

#### `src/components/profile/EditProfile.tsx`
```typescript
// Cho avatar và cover image
import { uploadToR2 } from '@/utils/r2Storage';
const result = await uploadToR2(croppedImageFile, 'image');
const avatarUrl = result.publicUrl;
```

### Bước 5: Migration Dữ Liệu Cũ (Optional)

Nếu bạn đã có dữ liệu trong Supabase Storage, tạo script migration:

```typescript
// scripts/migrate-to-r2.ts
import { supabase } from '@/integrations/supabase/client';
import { uploadToR2 } from '@/utils/r2Storage';

async function migrateToR2() {
  // 1. Lấy tất cả posts có media
  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .not('media_url', 'is', null);

  for (const post of posts || []) {
    try {
      // 2. Download file từ Supabase Storage
      const response = await fetch(post.media_url);
      const blob = await response.blob();
      const file = new File([blob], 'media', { type: post.media_type });

      // 3. Upload lên R2
      const result = await uploadToR2(file, post.media_type === 'image/jpeg' ? 'image' : 'video');

      // 4. Update database
      await supabase
        .from('posts')
        .update({ media_url: result.publicUrl })
        .eq('id', post.id);

      console.log(`Migrated post ${post.id}`);
    } catch (error) {
      console.error(`Failed to migrate post ${post.id}:`, error);
    }
  }
}
```

## Kiểm Tra & Testing

### Test Upload Function
```bash
# Deploy edge functions (tự động)
# Functions sẽ được deploy khi bạn save changes

# Test upload từ frontend
# 1. Mở app trong browser
# 2. Thử tạo post mới với ảnh
# 3. Check console logs trong edge function
```

### Debug Checklist
- [ ] Secrets đã được set đúng values
- [ ] Bucket name chính xác
- [ ] API permissions đủ (Read & Write)
- [ ] Public access được enable
- [ ] Custom domain đã setup DNS (nếu dùng)

## So Sánh Chi Phí

### Supabase Storage (hiện tại)
- Storage: $0.021/GB/month
- Egress: $0.09/GB (bandwidth ra ngoài)
- **Ví dụ**: 100GB storage + 1TB egress = $92.10/month

### Cloudflare R2
- Storage: $0.015/GB/month
- Egress: **$0** (miễn phí hoàn toàn!)
- Operations: $4.50/million writes, $0.36/million reads
- **Ví dụ**: 100GB storage + 1TB egress = $1.50/month + operations

### Tiết Kiệm
Với traffic cao, R2 có thể tiết kiệm **90%+ chi phí** so với Supabase Storage.

## Cấu Hình Nâng Cao

### CORS Configuration
Nếu cần custom CORS cho R2 bucket:
```json
{
  "AllowedOrigins": ["https://yourdomain.com"],
  "AllowedMethods": ["GET", "PUT", "POST"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3000
}
```

### Signed URLs (Private Access)
Để tạo signed URLs với expiry time, implement trong edge function:

```typescript
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const command = new GetObjectCommand({
  Bucket: bucketName,
  Key: fileName,
});

const signedUrl = await getSignedUrl(s3Client, command, {
  expiresIn: 3600 // 1 hour
});
```

### Image Optimization
Cloudflare Images có thể tích hợp với R2:
- Automatic resizing
- Format conversion (WebP, AVIF)
- Lazy loading
- URL: `https://imagedelivery.net/<account-hash>/<image-id>/<variant-name>`

## Troubleshooting

### Lỗi: "Access Denied"
- Kiểm tra API token có quyền Read & Write
- Verify Account ID đúng
- Check bucket name không có typo

### Lỗi: "Bucket not found"
- Đảm bảo bucket đã được tạo
- Verify R2_BUCKET_NAME secret
- Check region (nên để `auto`)

### Files upload nhưng không hiển thị
- Kiểm tra public access đã enable
- Verify URL format đúng
- Check CORS configuration

### Lỗi TypeScript trong edge function
- Edge functions tự động type-check
- Xem logs trong Lovable Cloud dashboard
- Check imports và types

## Liên Hệ & Support

- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [AWS S3 SDK Docs](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/)
- [Lovable Cloud Docs](https://docs.lovable.dev/features/cloud)

## Next Steps

1. ✅ Secrets đã được configure
2. ✅ Edge functions đã được tạo
3. ✅ Utility functions ready to use
4. ⏳ Tạo R2 bucket trong Cloudflare
5. ⏳ Setup public access / custom domain
6. ⏳ Update frontend code để sử dụng R2
7. ⏳ Test upload/download
8. ⏳ Migration dữ liệu cũ (optional)

---

**Lưu Ý Quan Trọng**: 
- Edge functions sẽ được deploy tự động khi bạn save changes
- Không cần manually deploy
- Files được lưu với format: `{user_id}/{random-uuid}.{ext}`
- Public URLs có format: `https://{bucket}.{account-id}.r2.dev/{fileName}` hoặc custom domain
