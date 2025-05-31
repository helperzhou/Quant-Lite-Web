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
  getDocs,
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
  purchasePrice?: number | string
  unit?: string
  qty?: number
  minQty?: number
  maxQty?: number
  availableValue?: number
}

function useProductSalesStats (products) {
  const [bestsellers, setBestsellers] = useState<{ [id: string]: number }>({})

  useEffect(() => {
    async function fetchSales () {
      const salesSnapshot = await getDocs(collection(db, 'sales'))
      const salesData = salesSnapshot.docs.map(doc => doc.data())
      // Aggregate: productId -> total quantity sold
      const productSales = {}
      for (const sale of salesData) {
        if (Array.isArray(sale.cart)) {
          for (const item of sale.cart) {
            const id = item.id
            if (!id) continue
            productSales[id] = (productSales[id] || 0) + (item.quantity || 0)
          }
        }
      }
      setBestsellers(productSales)
    }
    fetchSales()
  }, [products]) // re-aggregate if product list changes

  return bestsellers
}

const ProductsPage = () => {
  const { currentUser } = useOutletContext<any>()
  const [importerOpen, setImporterOpen] = useState(false)
  const companyName = currentUser?.companyName
  const [messageApi, contextHolder] = message.useMessage()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [manualDrawerOpen, setManualDrawerOpen] = useState(false)
  const [form] = Form.useForm()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [search, setSearch] = useState('')
  const [tabKey, setTabKey] = useState('list')
  const [importDrawerOpen, setImportDrawerOpen] = useState(false)
  const [restockModalVisible, setRestockModalVisible] = useState(false)
  const [restockProduct, setRestockProduct] = useState<Product | null>(null)
  const [restockForm] = Form.useForm()
  const [formType, setFormType] = useState<'product' | 'service'>('product')
  const isMobile = useMediaQuery({ maxWidth: 767 })

  // Fetch products
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
            unitPrice: d.unitPrice ?? d.price ?? 0,
            purchasePrice: d.purchasePrice ?? 0,
            unitPurchasePrice: d.unitPurchasePrice ?? 0,
            unit: d.unit || ''
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
    // eslint-disable-next-line
  }, [companyName])

  // Properly sync form fields & type when modal/drawer is opened and when editingProduct changes
  useEffect(() => {
    if (modalVisible || manualDrawerOpen) {
      if (editingProduct) {
        // Edit mode
        form.setFieldsValue({
          ...editingProduct,
          sellingPrice:
            editingProduct.unitPrice ?? editingProduct.sellingPrice ?? 0,
          purchasePrice: editingProduct.purchasePrice ?? 0,
          type: editingProduct.type ?? 'product'
        })
        setFormType(editingProduct.type ?? 'product')
      } else {
        // Add mode
        form.resetFields()
        form.setFieldsValue({ type: 'product' })
        setFormType('product')
      }
    }
    // eslint-disable-next-line
  }, [modalVisible, manualDrawerOpen, editingProduct])

  // Always reset everything on close
  const closeForm = () => {
    setModalVisible(false)
    setManualDrawerOpen(false)
    setEditingProduct(null)
    form.resetFields()
    setFormType('product')
  }

  // Use this for both Add and Edit. For Add: openForm(null)
  const openForm = (record: Product | null = null) => {
    setEditingProduct(record)
    if (isMobile) setManualDrawerOpen(true)
    else setModalVisible(true)
  }

  // Delete
  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id))
      messageApi.success('Product deleted')
    } catch (err: any) {
      messageApi.error('Failed to delete product')
    }
  }

  // Restock
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
      const unitPurchasePrice =
        values.qty > 0 ? +(values.purchasePrice / values.qty).toFixed(2) : 0

      await updateDoc(doc(db, 'products', restockProduct.id), {
        qty: updatedQty,
        purchasePrice: values.purchasePrice,
        unitPurchasePrice,
        lastRestocked: new Date(),
        companyName
      })
      messageApi.success('Product restocked')
      setRestockModalVisible(false)
      setRestockProduct(null)
    } catch (err: any) {
      messageApi.error('Failed to restock product')
    }
  }

  // Add or Edit
  const handleSave = async (values: any) => {
    try {
      const isNew = !editingProduct
      let unitPurchasePrice = 0
      if (values.type === 'product') {
        if (isNew && values.purchasePrice && values.qty) {
          unitPurchasePrice = +(values.purchasePrice / values.qty).toFixed(2)
        } else if (editingProduct?.unitPurchasePrice) {
          unitPurchasePrice = editingProduct.unitPurchasePrice
        }
      }

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
              unitPurchasePrice,
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
      closeForm()
    } catch (err: any) {
      messageApi.error('Error saving product')
    }
  }

  const bestsellers = useProductSalesStats(products)
  const sortedProducts = [...products].sort(
    (a, b) => (bestsellers[b.id] || 0) - (bestsellers[a.id] || 0)
  )

  const filteredProducts = sortedProducts.filter(p =>
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
      {/* For products, show selling & purchase price side by side (add only).
          For edit, just show selling price (purchase price can be edited on restock) */}
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
                  style={{ marginBottom: 0 }}
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
      {contextHolder}
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
                  onClick={() => openForm(null)} // <--- ADD: always null!
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
                          onClick={() => openForm(product)} // <--- EDIT: pass product!
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
                      <strong>Unit Purchase Price:</strong>{' '}
                      {product.unitPurchasePrice
                        ? `R${product.unitPurchasePrice}`
                        : '-'}
                    </p>
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
                    title: 'Unit Purchase Price',
                    dataIndex: 'unitPurchasePrice',
                    key: 'unitPurchasePrice',
                    render: val => (val ? `R${val}` : '-')
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
                          onClick={() => openForm(record)} // <--- EDIT: pass product!
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
          onClose={closeForm}
          placement='bottom'
          height='auto'
        >
          {renderForm()}
        </Drawer>

        <Modal
          title={editingProduct ? 'Edit Product' : 'Add Product'}
          open={!isMobile && modalVisible}
          onCancel={closeForm}
          footer={null}
        >
          {renderForm()}
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
            label='Purchase Price (total price)'
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
