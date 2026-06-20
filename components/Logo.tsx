'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2">
      <Image src="/logo.png" alt="Logo" width={32} height={32} />
      <span className="text-xl font-bold text-blue-600">SheetInvoicer</span>
    </Link>
  )
}
