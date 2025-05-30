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

const ProductsPage = () => {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [editingProduct, setEditingProduct] = useState(null)
  const isMobile = useMediaQuery({ maxWidth: 767 })
  const [search, setSearch] = useState('')
  const [tabKey, setTabKey] = useState('list')
  const [formType, setFormType] = useState('product') // new state

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'products'),
      snapshot => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setProducts(data)
        setLoading(false)
      },
      err => {
        message.error('Failed to fetch products')
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  const handleDelete = async id => {
    try {
      await deleteDoc(doc(db, 'products', id))
      message.success('Product deleted')
    } catch (err) {
      message.error('Failed to delete product')
    }
  }

  const openForm = record => {
    form.resetFields()
    if (record) {
      setEditingProduct(record)
      setTimeout(() => {
        form.setFieldsValue({
          ...record,
          price: record.price || record.unitPrice
        })
      }, 0)
    } else {
      setEditingProduct(null)
    }
    if (isMobile) {
      setDrawerVisible(true)
    } else {
      setModalVisible(true)
    }
  }

  const handleSave = async values => {
    try {
      const data = {
        name: values.name,
        type: values.type,
        ...(values.type === 'product'
          ? {
              unitPrice: parseFloat(values.price),
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
        message.success('Product updated')
      } else {
        await addDoc(collection(db, 'products'), data)
        message.success('Product added')
      }
      setDrawerVisible(false)
      setModalVisible(false)
    } catch (err) {
      message.error('Error saving product')
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
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
          <Option value='product'>Product</Option>
          <Option value='service'>Service</Option>
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
      {/* Show these only for product */}
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
      {/* Available Value is only for service */}
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
    <div className='bg-white p-4 rounded-lg shadow-sm'>
      <Tabs activeKey={tabKey} onChange={key => setTabKey(key)}>
        <Tabs.TabPane tab='Products List' key='list'>
          <div className='flex justify-between items-center mb-4'>
            <h2 className='text-xl font-semibold'>Products</h2>
            <Button
              type='primary'
              icon={<PlusOutlined />}
              onClick={() => openForm(null)}
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
            <Table
              columns={[
                { title: 'Name', dataIndex: 'name', key: 'name' },
                { title: 'Type', dataIndex: 'type', key: 'type' },
                {
                  title: 'Price',
                  dataIndex: 'price',
                  key: 'price',
                  render: (_, r) => `R${r.price || r.unitPrice}`
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
    </div>
  )
}

export default ProductsPage
