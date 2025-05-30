import { useEffect, useState } from 'react'
import {
  Tabs,
  Select,
  Button,
  Drawer,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
  Card,
  Modal,
  Table,
  InputNumber,
  Tag
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  addDoc
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useMediaQuery } from 'react-responsive'
import ProductStatisticsDashboard from '../../components/ProductsDashboard'
import type { Product } from '../../types/type'

type ProductFormValues = {
  name: string
  type: 'product' | 'service'
  price: number | string
  qty?: number
  minQty?: number
  maxQty?: number
  availableValue?: number
}

type ReceiptItem = {
  name: string
  quantity: number
  unit_price: number
  total_price: number
  category: string
}

type ReceiptData = {
  store_name: string
  receipt_date: string
  total_amount: number
  items: ReceiptItem[]
}
const ProductsPage = () => {
  const [messageApi, contextHolder] = message.useMessage()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const isMobile = useMediaQuery({ maxWidth: 767 })
  const [search, setSearch] = useState('')
  const [tabKey, setTabKey] = useState('list')
  const [methodModal, setMethodModal] = useState(false)
  const [addMethod, setAddMethod] = useState<'manual' | 'image' | null>(null)
  const [formType, setFormType] = useState<'product' | 'service'>('product')
  const [receiptModal, setReceiptModal] = useState(false)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'products'),
      snapshot => {
        const data: Product[] = snapshot.docs.map(doc => {
          const d = doc.data() as Partial<Product>
          return {
            id: doc.id,
            name: d.name || '',
            type: d.type || 'product',
            price: typeof d.price !== 'undefined' ? d.price : d.unitPrice ?? 0,
            qty: d.qty ?? 0,
            minQty: d.minQty ?? 0,
            maxQty: d.maxQty ?? 0,
            availableValue: d.availableValue ?? 0,
            unitPrice: d.unitPrice ?? d.price ?? 0
          }
        })
        setProducts(data)

        setLoading(false)
      },
      err => {
        messageApi.error('Failed to fetch products')
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id))
      messageApi.success('Product deleted')
    } catch (err) {
      messageApi.error('Failed to delete product')
    }
  }

  const openForm = (record: Product | null = null, prefill: any = null) => {
    form.resetFields()
    setEditingProduct(record)
    setFormType(prefill?.type || record?.type || 'product')
    setTimeout(() => {
      form.setFieldsValue({
        ...record,
        ...prefill,
        price: prefill?.price ?? record?.price ?? record?.unitPrice ?? 0
      })
    }, 0)
    if (isMobile) setDrawerVisible(true)
    else setModalVisible(true)
  }

  const handleSave = async (values: Product) => {
    try {
      const data = {
        name: values.name,
        type: values.type,
        ...(values.type === 'product'
          ? {
              unitPrice:
                typeof values.price === 'number'
                  ? values.price
                  : parseFloat(values.price),
              qty: values.qty || 0,
              minQty: values.minQty || 0,
              maxQty: values.maxQty || 0,
              currentStock: 0
            }
          : {
              price: parseFloat(values.price),
              availableValue: values.availableValue || 0
            })
      }

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), data)
        messageApi.success('Product updated')
      } else {
        await addDoc(collection(db, 'products'), data)
        messageApi.success('Product added')
      }
      setDrawerVisible(false)
      setModalVisible(false)
    } catch (err) {
      messageApi.error('Error saving product')
    }
  }

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  )

  const renderForm = () => (
    <Form
      form={form}
      layout='vertical'
      onFinish={handleSave}
      initialValues={{ type: formType }}
      onValuesChange={(changed, all) => {
        if (changed.type) setFormType(changed.type)
      }}
    >
      <Form.Item
        name='type'
        label='Type'
        rules={[{ required: true, message: 'Please select Type' }]}
      >
        <Select placeholder='Select type'>
          <Select.Option value='product'>Product</Select.Option>
          <Select.Option value='service'>Service</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item
        name='name'
        label='Name'
        rules={[{ required: true, message: 'Please enter Name' }]}
      >
        <Input placeholder='Enter name' />
      </Form.Item>
      <Form.Item
        name='price'
        label='Price'
        rules={[{ required: true, message: 'Please enter Price' }]}
      >
        <InputNumber min={0} style={{ width: '100%' }} />
      </Form.Item>
      {formType === 'product' && (
        <>
          <Form.Item name='qty' label='Quantity'>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name='minQty' label='Min Qty'>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name='maxQty' label='Max Qty'>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </>
      )}
      {formType === 'service' && (
        <Form.Item
          name='availableValue'
          label='Available Value'
          rules={[{ required: false }]}
        >
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
      )}
      <Form.Item>
        <Button type='primary' htmlType='submit' block>
          {editingProduct ? 'Update' : 'Create'}
        </Button>
      </Form.Item>
    </Form>
  )

  return (
    <>
      {contextHolder}{' '}
      <div className='bg-white p-4 rounded-lg shadow-sm'>
        <Tabs activeKey={tabKey} onChange={key => setTabKey(key)}>
          <Tabs.TabPane tab='Products List' key='list'>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-xl font-semibold'>Products</h2>
              <Button
                type='primary'
                icon={<PlusOutlined />}
                onClick={() => setMethodModal(true)}
              >
                Add Product
              </Button>
            </div>
            <Input.Search
              placeholder='Search products by name'
              value={search}
              onChange={e => setSearch(e.target.value)}
              className='mb-4'
              allowClear
            />

            {isMobile ? (
              <Space direction='vertical' style={{ width: '100%' }}>
                {filteredProducts.map(product => (
                  <Card
                    key={product.id}
                    title={product.name}
                    size='small'
                    extra={
                      <Space>
                        <Button
                          icon={<EditOutlined />}
                          onClick={() => openForm(product)}
                        />
                        <Popconfirm
                          title='Delete product?'
                          onConfirm={() => handleDelete(product.id)}
                          okText='Yes'
                          cancelText='No'
                        >
                          <Button icon={<DeleteOutlined />} danger />
                        </Popconfirm>
                      </Space>
                    }
                  >
                    <p>Type: {product.type}</p>
                    <p>Price: R{product.price || product.unitPrice}</p>
                  </Card>
                ))}
              </Space>
            ) : (
              <Table<Product>
                columns={[
                  { title: 'Name', dataIndex: 'name', key: 'name' },
                  { title: 'Type', dataIndex: 'type', key: 'type' },
                  {
                    title: 'Price',
                    dataIndex: 'price',
                    key: 'price',
                    render: (_, r) => `R${r.unitPrice ?? r.price ?? 0}`
                  },
                  {
                    title: 'Actions',
                    key: 'actions',
                    render: (_, record) => (
                      <Space>
                        <Button
                          icon={<EditOutlined />}
                          onClick={() => openForm(record)}
                        />
                        <Popconfirm
                          title='Delete product?'
                          onConfirm={() => handleDelete(record.id)}
                          okText='Yes'
                          cancelText='No'
                        >
                          <Button icon={<DeleteOutlined />} danger />
                        </Popconfirm>
                      </Space>
                    )
                  }
                ]}
                dataSource={filteredProducts}
                rowKey='id'
                loading={loading}
                pagination={{ pageSize: 6 }}
                scroll={{ x: true }}
              />
            )}
          </Tabs.TabPane>
          <Tabs.TabPane tab='Statistics' key='statistics'>
            <div className='py-4'>
              <ProductStatisticsDashboard products={products} />
            </div>
          </Tabs.TabPane>
        </Tabs>

        <Drawer
          title={editingProduct ? 'Edit Product' : 'Add Product'}
          open={isMobile && drawerVisible}
          onClose={() => setDrawerVisible(false)}
          placement='bottom'
          height='auto'
        >
          {renderForm()}
        </Drawer>

        <Modal
          title={editingProduct ? 'Edit Product' : 'Add Product'}
          open={!isMobile && modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={null}
        >
          {renderForm()}
        </Modal>

        <Modal
          open={methodModal}
          title='How would you like to add?'
          onCancel={() => setMethodModal(false)}
          footer={null}
          centered
        >
          <Space direction='vertical' style={{ width: '100%' }}>
            <Button
              block
              size='large'
              onClick={() => {
                setAddMethod('manual')
                setMethodModal(false)
                openForm(null)
              }}
            >
              Manual Entry
            </Button>
            <Button
              block
              size='large'
              type='dashed'
              onClick={() => {
                setAddMethod('image')
                setMethodModal(false)
                setReceiptModal(true)
              }}
            >
              Scan/Upload Receipt
            </Button>
          </Space>
        </Modal>

        <Modal
          open={receiptModal}
          title='Upload or Capture Receipt'
          onCancel={() => setReceiptModal(false)}
          footer={null}
          centered
        >
          <input
            type='file'
            accept='image/*'
            capture='environment'
            onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              if (file) {
                setReceiptLoading(true)
                setReceiptData(null)
                try {
                  const formData = new FormData()
                  formData.append('image', file)
                  const res = await fetch(
                    'https://rairo-pos-image-api.hf.space/process-receipt',
                    { method: 'POST', body: formData }
                  )
                  const data = await res.json()
                  if (data.success && data.data?.items?.length) {
                    setReceiptData(data.data)
                  } else {
                    messageApi.error('Could not extract receipt info.')
                  }
                } catch (err) {
                  messageApi.error('Failed to process image.')
                } finally {
                  setReceiptLoading(false)
                }
              }
            }}
          />
          {receiptLoading && <p>Extracting details...</p>}
          {receiptData && (
            <div style={{ marginTop: 12 }}>
              <p>
                <b>Store:</b> {receiptData.store_name} <br />
                <b>Date:</b> {receiptData.receipt_date} <br />
                <b>Total:</b> R{receiptData.total_amount}
              </p>
              {receiptData.items && (
                <ul>
                  {receiptData.items.map((item, i) => (
                    <li key={i}>
                      {item.name} x{item.quantity} @ R{item.unit_price} — R
                      {item.total_price} [{item.category}]
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type='primary'
                style={{ marginTop: 10 }}
                onClick={() => {
                  setReceiptModal(false)
                  setTimeout(() => {
                    setEditingProduct(null)
                    setAddMethod('manual')
                    form.setFieldsValue({
                      name: receiptData.items[0]?.name || '',
                      type:
                        receiptData.items[0]?.category === 'stock'
                          ? 'product'
                          : 'service',
                      price: receiptData.items[0]?.unit_price || '',
                      qty: receiptData.items[0]?.quantity || ''
                    })
                    if (isMobile) setDrawerVisible(true)
                    else setModalVisible(true)
                  }, 300)
                }}
                block
              >
                Use & Edit These Details
              </Button>
            </div>
          )}
        </Modal>
      </div>
    </>
  )
}

export default ProductsPage
