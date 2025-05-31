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
  Tag,
  Col,
  Row
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined
} from '@ant-design/icons'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useMediaQuery } from 'react-responsive'
import ProductStatisticsDashboard from '../../components/ProductsDashboard'
import type { Product } from '../../types/type'
import { useOutletContext } from 'react-router-dom'
import ReceiptProductImporter from './ProductReceiptUpload'

type ProductFormValues = {
  name: string
  type: 'product' | 'service'
  sellingPrice: number | string
  purchasePrice?: number | string // Only set when restocking/adding
  unit?: string // e.g. "kg", "item", "litre"
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
  const { currentUser } = useOutletContext<any>()
  const [importerOpen, setImporterOpen] = useState(false)
  const companyName = currentUser?.companyName
  const [messageApi, contextHolder] = message.useMessage()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [search, setSearch] = useState('')
  const [tabKey, setTabKey] = useState('list')
  const [methodModal, setMethodModal] = useState(false)
  const [addMethod, setAddMethod] = useState<'manual' | 'image' | null>(null)
  const [formType, setFormType] = useState<'product' | 'service'>('product')
  const isMobile = useMediaQuery({ maxWidth: 767 })
  const [manualDrawerOpen, setManualDrawerOpen] = useState(false)
  const [importDrawerOpen, setImportDrawerOpen] = useState(false)
  const [restockModalVisible, setRestockModalVisible] = useState(false)
  const [restockProduct, setRestockProduct] = useState<Product | null>(null)
  const [restockForm] = Form.useForm()

  useEffect(() => {
    if (!companyName) return
    const q = query(
      collection(db, 'products'),
      where('companyName', '==', companyName)
    )
    const unsub = onSnapshot(
      q,
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
  }, [companyName])

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id))
      messageApi.success('Product deleted')
    } catch (err: any) {
      messageApi.error('Failed to delete product')
    }
  }

  const openRestockModal = (product: Product) => {
    setRestockProduct(product)
    restockForm.resetFields()
    setRestockModalVisible(true)
  }

  const handleRestock = async (values: {
    qty: number
    purchasePrice: number
  }) => {
    if (!restockProduct) return
    try {
      const updatedQty = (restockProduct.qty ?? 0) + values.qty
      await updateDoc(doc(db, 'products', restockProduct.id), {
        qty: updatedQty,
        purchasePrice: values.purchasePrice,
        lastRestocked: new Date(),
        companyName // <-- also here (optional if it never changes, but safe for consistency)
      })
      messageApi.success('Product restocked')
      setRestockModalVisible(false)
      setRestockProduct(null)
    } catch (err: any) {
      messageApi.error('Failed to restock product')
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
        sellingPrice:
          prefill?.sellingPrice ??
          record?.unitPrice ??
          record?.sellingPrice ??
          0,
        purchasePrice: prefill?.purchasePrice ?? record?.purchasePrice ?? 0
      })
    }, 0)
    if (isMobile) setDrawerVisible(true)
    else setModalVisible(true)
  }

  const handleSave = async (values: any) => {
    try {
      const isNew = !editingProduct
      // If creating new: take purchasePrice from form, else preserve old value (or allow edit)
      const data: any = {
        name: values.name,
        type: values.type,
        companyName,
        unit: values.unit,
        qty: values.qty || 0,
        minQty: values.minQty || 0,
        maxQty: values.maxQty || 0,
        unitPrice:
          typeof values.sellingPrice === 'number'
            ? values.sellingPrice
            : parseFloat(values.sellingPrice),
        ...(values.type === 'product'
          ? {
              purchasePrice: isNew
                ? typeof values.purchasePrice === 'number'
                  ? values.purchasePrice
                  : parseFloat(values.purchasePrice || 0)
                : values.purchasePrice !== undefined
                ? typeof values.purchasePrice === 'number'
                  ? values.purchasePrice
                  : parseFloat(values.purchasePrice)
                : editingProduct?.purchasePrice ?? 0,
              currentStock: 0
            }
          : {
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
      if (isMobile) {
        setManualDrawerOpen(false)
      } else {
        setModalVisible(false)
      }
    } catch (err: any) {
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

      {formType === 'product' && !editingProduct ? (
        <Form.Item required>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name='sellingPrice'
                label='Selling Price'
                rules={[{ required: true }]}
                style={{ marginBottom: 0 }}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name='purchasePrice'
                label='Purchase Price'
                rules={[{ required: true }]}
                style={{ marginBottom: 0 }}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form.Item>
      ) : (
        <Form.Item
          name='sellingPrice'
          label='Selling Price'
          rules={[{ required: true }]}
        >
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
      )}

      {formType === 'product' && (
        <>
          <Form.Item name='unit' label='Unit' rules={[{ required: true }]}>
            <Input placeholder='e.g. kg, litre, box' />
          </Form.Item>
          <Form.Item name='qty' label='Quantity'>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item required>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item
                  name='minQty'
                  label='Min Qty'
                  rules={[{ required: true, message: 'Enter Min Qty' }]}
                  style={{ marginBottom: 0 }} // Removes double margin with nested Form.Item
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name='maxQty'
                  label='Max Qty'
                  rules={[{ required: true, message: 'Enter Max Qty' }]}
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
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
            <div className='flex flex-col sm:flex-row sm:justify-between items-start sm:items-center mb-4'>
              <h2 className='text-xl font-semibold mb-2 sm:mb-0'>Products</h2>
              <div
                className={
                  isMobile ? 'flex flex-col gap-2 w-full' : 'flex gap-2'
                }
              >
                <Button
                  type='primary'
                  icon={<PlusOutlined />}
                  block={isMobile}
                  onClick={() => {
                    if (isMobile) {
                      setManualDrawerOpen(true)
                    } else {
                      setModalVisible(true)
                    }
                  }}
                >
                  Add Product
                </Button>
                <Button
                  icon={<UploadOutlined />}
                  block={isMobile}
                  onClick={() => setImportDrawerOpen(true)}
                >
                  Scan/Upload Receipt
                </Button>
              </div>
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
                        <Button onClick={() => openRestockModal(product)}>
                          Restock
                        </Button>
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
                    <p>
                      <strong>Current Quantity: {product.qty ?? 0}</strong>
                      {product.unit ? ` ${product.unit}` : ''}
                    </p>
                  </Card>
                ))}
              </Space>
            ) : (
              <Table<Product>
                columns={[
                  { title: 'Name', dataIndex: 'name', key: 'name' },
                  { title: 'Type', dataIndex: 'type', key: 'type' },
                  {
                    title: 'Quantity',
                    dataIndex: 'qty',
                    key: 'qty',
                    render: (qty, rec) =>
                      rec.unit ? `${qty ?? 0} ${rec.unit}` : qty ?? 0
                  },
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
                        <Button onClick={() => openRestockModal(record)}>
                          Restock
                        </Button>
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
          open={isMobile && manualDrawerOpen}
          onClose={() => setManualDrawerOpen(false)}
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
            <Button type='primary' onClick={() => setImporterOpen(true)}>
              Scan/Upload Receipt
            </Button>
          </Space>
        </Modal>

        {/* Receipt Import Drawer */}
        <Drawer
          title='Import Products from Receipt(s)'
          open={importDrawerOpen}
          onClose={() => setImportDrawerOpen(false)}
          placement={isMobile ? 'bottom' : 'right'}
          height={isMobile ? '100vh' : undefined}
          width={isMobile ? '100vw' : 700}
          destroyOnClose
        >
          {/* All your receipt upload/import UI */}
          <ReceiptProductImporter
            companyName={companyName}
            onClose={() => setImportDrawerOpen(false)}
          />
        </Drawer>
      </div>
      <Modal
        open={restockModalVisible}
        title='Restock Product'
        onCancel={() => setRestockModalVisible(false)}
        footer={null}
      >
        <Form form={restockForm} layout='vertical' onFinish={handleRestock}>
          <Form.Item
            name='qty'
            label='Quantity to Add'
            rules={[{ required: true }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name='purchasePrice'
            label='Purchase Price (per unit)'
            rules={[{ required: true }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type='primary' htmlType='submit' block>
              Restock
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default ProductsPage
