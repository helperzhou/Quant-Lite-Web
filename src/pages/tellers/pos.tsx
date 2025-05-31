import React, { useState, useEffect } from 'react'
import {
  Button,
  Card,
  Col,
  Input,
  Modal,
  Row,
  Table,
  Typography,
  Select,
  Tag,
  Divider,
  Grid,
  Form,
  InputNumber,
  message
} from 'antd'
import {
  PlusOutlined,
  UserAddOutlined,
  ShoppingCartOutlined
} from '@ant-design/icons'
import { db } from '../../firebase'
import {
  getDocs,
  collection,
  addDoc,
  orderBy,
  query,
  where,
  Timestamp,
  runTransaction,
  doc
} from 'firebase/firestore'
import { useOutletContext } from 'react-router-dom'
import type { CartItem, Customer, PaymentType, Product } from '../../types/type'

const useBreakpoint = Grid.useBreakpoint
const { Title, Text } = Typography

export default function POSScreen () {
  const [messageApi, contextHolder] = message.useMessage()
  const { currentUser } = useOutletContext()
  // Helper to get the branch for the logged-in teller
  const tellerBranch =
    (currentUser &&
      (currentUser.branch ||
        (Array.isArray(currentUser.branches)
          ? currentUser.branches[0]
          : null))) ||
    ''

  const screens = useBreakpoint()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])

  // Selection
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  )

  const [customerModal, setCustomerModal] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [newCustomerForm] = Form.useForm()
  const [showNewCustomer, setShowNewCustomer] = useState(false)

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const [productModal, setProductModal] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productQty, setProductQty] = useState(1)

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])

  // Payment
  const [paymentType, setPaymentType] = useState<PaymentType>('Cash')
  const [amountPaid, setAmountPaid] = useState(0)
  const [dueDate, setDueDate] = useState(null)

  // Fetch customers/products (filtered by companyName)
  useEffect(() => {
    async function fetchData () {
      if (!currentUser?.companyName) return
      console.log(currentUser.companyName)
      const cSnap = await getDocs(
        query(
          collection(db, 'customers'),
          where('companyName', '==', currentUser.companyName),
          orderBy('name')
        )
      )
      const pSnap = await getDocs(
        query(collection(db, 'products'), orderBy('name'))
      )
      setCustomers(
        cSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Customer))
      )
      setProducts(
        pSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product))
      )
    }
    fetchData()
  }, [currentUser])

  // Add to cart logic
  const addToCart = () => {
    if (!selectedProduct || productQty < 1) return
    const availableQty = selectedProduct.qty ?? 0
    const alreadyInCart =
      cart.find(i => i.id === selectedProduct.id)?.quantity ?? 0
    if (productQty + alreadyInCart > availableQty) {
      messageApi.error(
        `Not enough stock. Only ${
          availableQty - alreadyInCart
        } units available.`
      )
      return
    }
    const existing = cart.find(i => i.id === selectedProduct.id)
    if (existing) {
      setCart(
        cart.map(i =>
          i.id === selectedProduct.id
            ? {
                ...i,
                quantity: i.quantity + productQty,
                subtotal: (i.quantity + productQty) * i.sellingPrice
              }
            : i
        )
      )
    } else {
      setCart([
        ...cart,
        {
          ...selectedProduct,
          quantity: productQty,
          subtotal: productQty * selectedProduct.sellingPrice
        }
      ])
    }
    setSelectedProduct(null)
    setProductQty(1)
    setProductModal(false)
  }

  // Remove from cart
  const removeFromCart = (id: string) => setCart(cart.filter(i => i.id !== id))

  // Add new customer logic (inline in modal)
  const handleAddCustomer = async (values: { name: string; phone: string }) => {
    // Prevent double entry: find by phone and companyName
    const existing = customers.find(
      c => c.phone.replace(/\D/g, '') === values.phone.replace(/\D/g, '') // normalize
    )
    if (existing) {
      // Use this customer instead
      setSelectedCustomer(existing)
      setCustomerModal(false)
      setShowNewCustomer(false)
      newCustomerForm.resetFields()
      messageApi.info(
        'Customer with that phone already exists. Selected existing record.'
      )
      return
    }

    // Save new customer
    const entry: Customer = {
      name: values.name,
      phone: values.phone,
      creditScore: 600,
      companyName: currentUser?.companyName || ''
    }
    const docRef = await addDoc(collection(db, 'customers'), entry)
    const customer = { ...entry, id: docRef.id }
    setCustomers(prev => [...prev, customer])
    setSelectedCustomer(customer)
    setCustomerModal(false)
    setShowNewCustomer(false)
    newCustomerForm.resetFields()
    messageApi.success('New customer added and selected.')
  }

  // Cart total
  const total = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const change = paymentType === 'Cash' ? amountPaid - total : 0

  // SALE SUBMISSION
  const handleSubmit = async () => {
    if (cart.length === 0) {
      messageApi.warning('Add at least one product to the cart')
      return
    }
    if (
      paymentType === 'Credit' &&
      (!selectedCustomer || (selectedCustomer.creditScore ?? 0) < 600)
    ) {
      messageApi.error('Customer credit score too low for credit sale')
      return
    }

    // Prepare sale object
    const sale: any = {
      cart,
      paymentType,
      total,
      branch: tellerBranch,
      tellerId: currentUser?.uid,
      tellerName: currentUser?.name || '',
      createdAt: Timestamp.now(),
      companyName: currentUser?.companyName || ''
    }

    if (selectedCustomer) {
      sale.customerId = selectedCustomer.id
      sale.customer = selectedCustomer.name
    }

    // Add fields for payment
    if (paymentType === 'Cash') {
      sale.amountPaid = amountPaid
      sale.change = change
      sale.bank = 0
      sale.credit = 0
    }
    if (paymentType === 'Bank') {
      sale.bank = total
      sale.amountPaid = 0
      sale.change = 0
      sale.credit = 0
    }
    if (paymentType === 'Credit') {
      sale.credit = total
      sale.dueDate = dueDate
      sale.amountPaid = 0
      sale.change = 0
      sale.bank = 0
    }

    try {
      // Deduct stock atomically for each product in the cart
      for (const item of cart) {
        const prodRef = doc(db, 'products', item.id)
        await runTransaction(db, async transaction => {
          const prodDoc = await transaction.get(prodRef)
          if (!prodDoc.exists()) {
            throw new Error(`Product "${item.name}" does not exist.`)
          }
          const currentQty = prodDoc.data().qty ?? 0
          if (currentQty < item.quantity) {
            throw new Error(`Insufficient stock for ${item.name}.`)
          }
          transaction.update(prodRef, {
            qty: currentQty - item.quantity
          })
        })
      }

      // Save the sale after successful stock deduction
      await addDoc(collection(db, 'sales'), sale)
      setCart([])
      setAmountPaid(0)
      setDueDate(null)
      setSelectedCustomer(null)
      messageApi.success('Sale submitted successfully!')

      if (paymentType === 'Credit' && selectedCustomer) {
        const creditRecord = {
          customerId: selectedCustomer.id,
          name: selectedCustomer.name,
          amountDue: total,
          paidAmount: 0,
          dueDate,
          createdAt: Timestamp.now(),
          creditScore: selectedCustomer.creditScore ?? 600,
          branch: tellerBranch,
          companyName: currentUser?.companyName || '',
          products: cart
        }
        await addDoc(collection(db, 'credits'), creditRecord)
      }
    } catch (err: any) {
      console.error('Error during sale/stock deduction:', err)
      messageApi.error(err.message || 'Could not save sale or deduct stock.')
    }
  }

  return (
    <>
      {contextHolder}{' '}
      <div style={{ padding: 18, maxWidth: 650, margin: '0 auto' }}>
        <Title level={3}>Point of Sale</Title>

        {/* Customer Select */}
        <Card
          style={{ marginBottom: 12, cursor: 'pointer' }}
          onClick={() => setCustomerModal(true)}
          bodyStyle={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <Text strong>
              {selectedCustomer
                ? selectedCustomer.name
                : 'Select Customer (Optional)'}
            </Text>
            <div style={{ fontSize: 12, color: '#888' }}>
              {selectedCustomer?.phone}
            </div>
          </div>
          <UserAddOutlined />
        </Card>

        {/* Product Select */}
        <Card
          style={{ marginBottom: 12, cursor: 'pointer' }}
          onClick={() => setProductModal(true)}
          bodyStyle={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <Text strong>
              {selectedProduct ? selectedProduct.name : 'Select Product'}
            </Text>
            <div style={{ fontSize: 12, color: '#888' }}>
              {selectedProduct ? `Price: R${selectedProduct.sellingPrice}` : ''}
            </div>
          </div>
          <ShoppingCartOutlined />
        </Card>

        {/* Quantity & Add to Cart */}
        {selectedProduct && (
          <Row gutter={6} align='middle' style={{ marginBottom: 10 }}>
            <Col>
              <Button
                size='small'
                onClick={() => setProductQty(q => Math.max(1, q - 1))}
              >
                -
              </Button>
            </Col>
            <Col>
              <InputNumber
                min={1}
                value={productQty}
                onChange={setProductQty}
                style={{ width: 60 }}
              />
            </Col>
            <Col>
              <Button
                size='small'
                onClick={() => {
                  const max = selectedProduct?.qty ?? Infinity
                  setProductQty(q => Math.min(q + 1, max))
                }}
              >
                +
              </Button>
            </Col>
            <Col>
              <Button type='primary' onClick={addToCart}>
                Add to Cart
              </Button>
            </Col>
          </Row>
        )}

        {/* Cart */}
        <Card title='Cart' style={{ marginBottom: 14 }}>
          {screens.md ? (
            // Table for desktop/tablet
            <Table
              dataSource={cart}
              rowKey='id'
              pagination={false}
              columns={[
                { title: 'Product', dataIndex: 'name' },
                { title: 'Qty', dataIndex: 'quantity' },
                { title: 'Unit Price', dataIndex: 'sellingPrice' },
                {
                  title: 'Total',
                  render: (_, r) =>
                    `R${(r.sellingPrice * r.quantity).toFixed(2)}`
                },
                {
                  title: 'Action',
                  render: (_, r) => (
                    <Button
                      danger
                      size='small'
                      onClick={() => removeFromCart(r.id)}
                    >
                      Remove
                    </Button>
                  )
                }
              ]}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell colSpan={3}>Total</Table.Summary.Cell>
                  <Table.Summary.Cell>R{total.toFixed(2)}</Table.Summary.Cell>
                  <Table.Summary.Cell />
                </Table.Summary.Row>
              )}
            />
          ) : cart.length === 0 ? (
            <Text type='secondary'>Cart is empty</Text>
          ) : (
            cart.map(item => (
              <Card key={item.id} size='small' style={{ marginBottom: 6 }}>
                <Row justify='space-between' align='middle'>
                  <Col>
                    <Text strong>{item.name}</Text>{' '}
                    <Tag>
                      {item.quantity} x R{item.sellingPrice}
                    </Tag>
                    <div>Total: R{item.subtotal.toFixed(2)}</div>
                  </Col>
                  <Col>
                    <Button
                      size='small'
                      danger
                      onClick={() => removeFromCart(item.id)}
                    >
                      Remove
                    </Button>
                  </Col>
                </Row>
              </Card>
            ))
          )}
        </Card>

        {/* Payment and Submit */}
        <Card>
          <Row gutter={12} align='middle'>
            <Col flex='1 1 auto'>
              <Text strong>Payment Method</Text>
              <Select
                value={paymentType}
                onChange={setPaymentType}
                style={{ width: '100%' }}
              >
                <Select.Option value='Cash'>Cash</Select.Option>
                <Select.Option value='Bank'>Bank</Select.Option>
                <Select.Option value='Credit'>Credit</Select.Option>
              </Select>
            </Col>
            {paymentType === 'Cash' && (
              <Col flex='1 1 auto'>
                <Text>Amount Paid</Text>
                <InputNumber
                  min={0}
                  value={amountPaid}
                  onChange={setAmountPaid}
                  style={{ width: '100%' }}
                />
                <div>
                  <Text strong>
                    Change:&nbsp;
                    <span style={{ color: change < 0 ? 'red' : 'green' }}>
                      {change < 0 ? 'Insufficient' : `R${change.toFixed(2)}`}
                    </span>
                  </Text>
                </div>
              </Col>
            )}
            {paymentType === 'Credit' && (
              <Col flex='1 1 auto'>
                <Text>Due Date</Text>
                <Input
                  type='date'
                  value={dueDate || ''}
                  onChange={e => setDueDate(e.target.value)}
                  style={{ width: '100%' }}
                />
                {selectedCustomer && selectedCustomer.creditScore < 600 && (
                  <Text type='danger' style={{ color: 'red' }}>
                    Credit score too low for credit sales!
                  </Text>
                )}
              </Col>
            )}
          </Row>
          <Divider />
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <Text strong>Total: R{total.toFixed(2)}</Text>
          </div>
          <Button
            type='primary'
            block
            onClick={handleSubmit}
            disabled={
              cart.length === 0 ||
              (paymentType === 'Cash' && amountPaid < total) ||
              (paymentType === 'Credit' &&
                (!selectedCustomer || selectedCustomer.creditScore < 600))
            }
          >
            Submit Sale
          </Button>
        </Card>

        {/* ----------- Modals ----------- */}
        <Modal
          open={customerModal}
          onCancel={() => {
            setCustomerModal(false)
            setShowNewCustomer(false)
          }}
          footer={null}
          title='Select Customer'
        >
          <Input
            placeholder='Search'
            value={customerSearch}
            onChange={e => setCustomerSearch(e.target.value)}
            style={{ marginBottom: 10 }}
          />
          <div style={{ maxHeight: 270, overflowY: 'auto' }}>
            {customers
              .filter(c =>
                c.name.toLowerCase().includes(customerSearch.toLowerCase())
              )
              .map(c => (
                <Card
                  key={c.id}
                  style={{ marginBottom: 7, cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedCustomer(c)
                    setCustomerModal(false)
                  }}
                  size='small'
                  bodyStyle={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <Text strong>{c.name}</Text>
                    <div style={{ fontSize: 13, color: '#888' }}>{c.phone}</div>
                    <Tag color={c.creditScore >= 600 ? 'green' : 'red'}>
                      Score: {c.creditScore}
                    </Tag>
                  </div>
                </Card>
              ))}
          </div>
          {!showNewCustomer ? (
            <Button
              block
              type='dashed'
              icon={<PlusOutlined />}
              onClick={() => setShowNewCustomer(true)}
            >
              Add New Customer
            </Button>
          ) : (
            <Form
              form={newCustomerForm}
              onFinish={handleAddCustomer}
              layout='vertical'
              style={{ marginTop: 12 }}
            >
              <Form.Item
                name='name'
                label='Full Name'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name='phone'
                label='Phone Number'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Button htmlType='submit' type='primary' block>
                Save & Select
              </Button>
            </Form>
          )}
        </Modal>

        <Modal
          open={productModal}
          onCancel={() => setProductModal(false)}
          footer={null}
          title='Select Product'
        >
          <Input
            placeholder='Search'
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            style={{ marginBottom: 10 }}
          />
          <div style={{ maxHeight: 270, overflowY: 'auto' }}>
            {products
              .filter(p =>
                p.name.toLowerCase().includes(productSearch.toLowerCase())
              )
              .map(p => (
                <Card
                  key={p.id}
                  style={{ marginBottom: 7, cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedProduct(p)
                    setProductModal(false)
                  }}
                  size='small'
                  bodyStyle={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <Text strong>{p.name}</Text>
                    <div style={{ fontSize: 13, color: '#888' }}>
                      R{p.sellingPrice} &nbsp; | &nbsp; Stock: {p.qty ?? 0}{' '}
                      {p.unit || ''}
                    </div>
                  </div>
                </Card>
              ))}
          </div>
        </Modal>
      </div>
    </>
  )
}
