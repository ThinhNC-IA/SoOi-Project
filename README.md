# Sổ Ơi Next

Phiên bản TypeScript của Sổ Ơi, cùng nền tảng kỹ thuật với UniForge: Next.js App Router, React, TypeScript, Tailwind CSS 4, Zod và Supabase SSR.

## Chạy cục bộ

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`. Ứng dụng chạy local-first: dữ liệu mẫu và thao tác bán hàng được lưu trong Local Storage. Khi cần đồng bộ đa thiết bị, tạo `.env.local` từ `.env.example` và kết nối schema Supabase riêng của Sổ Ơi.

## Cấu trúc

- `src/app`: App Router, metadata và global styles
- `src/components/sooi`: UI nghiệp vụ bán hàng
- `src/lib/ledger`: types, seed data và các hàm nghiệp vụ thuần TypeScript
- `src/hooks`: persistence local-first
