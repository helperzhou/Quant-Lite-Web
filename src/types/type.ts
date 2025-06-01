// src/types.ts

// ==================
// Admin
// ==================
export interface Admin {
    id: string
    name: string
    email: string
    phone?: string
    uid?: string
    userRole: 'admin'
    companyName: string
    branches: string[]
    beneficiaryName?: string
    workers?: number
    monthlyTurnover?: number
  }

  // ==================
  // Teller
  // ==================
  export interface Teller {
    id: string
    name: string
    email: string
    phone?: string
    uid?: string
    userRole: 'teller'
    branch: string
    companyName: string
    branches: string[]
    beneficiaryName?: string
    workers?: number
    monthlyTurnover?: number
  }

  // ==================
  // Product
  // ==================
export type Product = {
    id: string
    name: string
    type: 'product' | 'service'
    price?: number         // for service
    unitPrice?: number
    purchasePrice?: number
    unitPurchasePrice?: number
    qty?: number
    minQty?: number
    maxQty?: number
    currentStock?: number
    availableValue?: number // for service
    unit?: string
  }

  // ==================
  // CashIn
  // ==================
  export interface CashIn {
    id: string
    tellerId: string
    tellerName: string
    branch: string
    cash: number
    bank?: number
    credit?: number
    date: string // or Timestamp if you're using Firestore Timestamp
    companyName: string
    adminId: string
  }

  // ==================
  // Credit (for Credit Payments)
  // ==================
  export interface Credit {
    id: string
    name: string // customer name
    amountDue: number
    paidAmount: number
    dueDate: string
    creditScore: number
  }

  // ==================
  // Generic User (if you need a shared base)
  // ==================
  export interface User {
    id: string
    name: string
    email: string
    phone?: string
    uid?: string
    userRole: string
    companyName: string
    branches: string[]
    beneficiaryName?: string
    workers?: number
    monthlyTurnover?: number
    branch?: string // only for tellers
  }

 export interface Customer {
    id: string
    name: string
    phone: string
    idNumber: string
    creditScore: number
    [key: string]: any
  }

  export interface CartItem extends Product {
    quantity: number
    subtotal: number
  }

  export type PaymentType = 'Cash' | 'Bank' | 'Credit'

  export interface Sale {
    customerId: string
    customer: string
    cart: CartItem[]
    paymentType: PaymentType
    total: number
    branch: string
    tellerId?: string
    tellerName?: string
    createdAt: any
    amountPaid?: number
    change?: number
    bank?: number
    credit?: number
    dueDate?: string | null
  }

  export interface CashInRecord {
    branch: string
    tellerId: string
    tellerName: string
    cash: number
    bank: number
    credit: number
    type: string // e.g. 'cash'
    date: any    // Firestore Timestamp
    companyName: string
    adminId: string
  }

  export interface BranchExpected {
    [branch: string]: number
  }


  // ==================
  // Others as needed...
  // ==================
