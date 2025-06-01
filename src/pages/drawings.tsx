import React, { useState, useEffect } from 'react'
import {
  Form,
  Select,
  InputNumber,
  DatePicker,
  Input,
  Button,
  message
} from 'antd'
import {
  Timestamp,
  doc,
  runTransaction,
  addDoc,
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore'
import dayjs from 'dayjs'
import { db } from '../firebase'
import { useOutletContext } from 'react-router-dom'
import type { Product } from '../types/type'

export default function DrawingsForm () {
  const { currentUser } = useOutletContext()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [msg, ctxHolder] = message.useMessage()

  useEffect(() => {
    async function fetchProducts () {
      if (!currentUser?.companyName) return // <- prevents null access

      const snap = await getDocs(
        query(
          collection(db, 'products'),
          where('companyName', '==', currentUser.companyName)
        )
      )
      setProducts(snap.docs.map(d => ({ ...d.data(), id: d.id })))
    }

    fetchProducts()
  }, [currentUser])

  const handleSubmit = async (values: any) => {
    const product = products.find(p => p.id === values.productId)
    if (!product) return msg.error('Invalid product selected.')

    const drawQty = Number(values.quantity)
    const prodRef = doc(db, 'products', product.id)
    setLoading(true)

    try {
      await runTransaction(db, async tx => {
        const docSnap = await tx.get(prodRef)
        const currentQty = docSnap.data()?.qty ?? 0
        if (drawQty > currentQty) {
          throw new Error(`Only ${currentQty} units in stock.`)
        }
        tx.update(prodRef, { qty: currentQty - drawQty })
      })

      const record = {
        productId: product.id,
        productName: product.name,
        quantity: drawQty,
        reason: values.reason || '',
        date: Timestamp.fromDate(values.date.toDate()),
        drawnBy: {
          uid: currentUser.uid,
          name: currentUser.name,
          role: currentUser.role
        },
        branch: currentUser.branch || '',
        companyName: currentUser.companyName || ''
      }

      await addDoc(collection(db, 'drawings'), record)

      // Also save as expense
      await addDoc(collection(db, 'expenses'), {
        name: `Product Draw: ${product.name}`,
        amount: drawQty * (product.unitPrice ?? product.price ?? 0),
        type: 'Drawing',
        createdAt: Timestamp.now(),
        branch: currentUser.branch || '',
        companyName: currentUser.companyName || '',
        notes: values.reason || ''
      })

      msg.success('Drawing recorded and expense logged.')
      form.resetFields()
    } catch (err: any) {
      console.error(err)
      msg.error(err.message || 'Failed to record drawing.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: 16 }}>
      {ctxHolder}
      <Form form={form} layout='vertical' onFinish={handleSubmit}>
        <Form.Item
          name='date'
          label='Date'
          initialValue={dayjs()}
          rules={[{ required: true }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name='productId'
          label='Product'
          rules={[{ required: true }]}
        >
          <Select
            showSearch
            placeholder='Select product'
            options={products.map(p => ({ label: p.name, value: p.id }))}
          />
        </Form.Item>

        <Form.Item
          name='quantity'
          label='Quantity'
          rules={[{ required: true, type: 'number', min: 1 }]}
        >
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name='reason' label='Reason (optional)'>
          <Input.TextArea
            rows={3}
            placeholder='e.g. used in kitchen, store cleaning, etc.'
          />
        </Form.Item>

        <Form.Item>
          <Button type='primary' htmlType='submit' block loading={loading}>
            Record Drawing
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}
