This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

`.env*` files are gitignored, so set these in your local `.env` and in Vercel
(Production + Preview). The full list lives in `CLAUDE.md`; the variables most
likely to be missed are the **Pusher** keys that power real-time admin
notifications (the app degrades gracefully — no live bell updates — when they're
absent):

```bash
# Pusher — real-time admin notification bell
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=                  # e.g. us2
NEXT_PUBLIC_PUSHER_KEY=          # same value as PUSHER_KEY
NEXT_PUBLIC_PUSHER_CLUSTER=      # same value as PUSHER_CLUSTER
```

Other required vars (see `CLAUDE.md` for the complete reference): `DATABASE_URL`,
`NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
`BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, and the PayPal keys.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
