import { useState } from 'react'
import {
  Button,
  Upload,
  Tabs,
  List,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  message,
  Spin,
  Row,
  Col
} from 'antd'
import { UploadOutlined, PlusOutlined } from '@ant-design/icons'
import { addDoc, collection } from 'firebase/firestore'
import { db } from '../../firebase'
import { useMediaQuery } from 'react-responsive'

const { Option } = Select

function flattenItems (results) {
  // Bulk API returns [{...data, items: [...] }]
  if (Array.isArray(results)) {
    return results.flatMap(r => r.data?.items || [])
  }
  // Single/multipart
  if (results?.items) return results.items
  return []
}

const defaultProduct = item => ({
  name: item.name || '',
  type: item.category === 'stock' ? 'product' : 'service',
  sellingPrice: Number(item.unit_price || 0),
  qty: Number(item.quantity || 1),
  unit: 'item'
})

export default function ReceiptProductUploader ({
  companyName = 'Ngenge Stores',
  onComplete
}) {
  const [tab, setTab] = useState('single')
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState([])
  const [bulkResults, setBulkResults] = useState([])
  const [form] = Form.useForm()
  const isMobile = useMediaQuery({ maxWidth: 767 })

  // Multipart session
  const [sessionId, setSessionId] = useState(null)
  const [parts, setParts] = useState([])

  // --- API Calls ---
  const processSingleReceipt = async file => {
    setLoading(true)
    const formData = new FormData()
    formData.append('image', file)
    try {
      const res = await fetch(
        'https://rairo-pos-image-api.hf.space/process-receipt',
        { method: 'POST', body: formData }
      )
      const data = await res.json()
      if (data.success) {
        setProducts((data.data.items || []).map(defaultProduct))
        message.success('Receipt processed')
      } else {
        message.error(data.error || 'Failed to process receipt')
      }
    } finally {
      setLoading(false)
    }
  }

  const startSession = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        'https://rairo-pos-image-api.hf.space/start-receipt-session',
        { method: 'POST' }
      )
      const data = await res.json()
      if (data.success) {
        setSessionId(data.session_id)
        setParts([])
        message.success('Multipart session started')
      }
    } finally {
      setLoading(false)
    }
  }

  const addPart = async file => {
    if (!sessionId) return message.error('Start a session first')
    setLoading(true)
    const formData = new FormData()
    formData.append('image', file)
    try {
      const res = await fetch(
        `https://rairo-pos-image-api.hf.space/add-receipt-part/${sessionId}`,
        { method: 'POST', body: formData }
      )
      const data = await res.json()
      if (data.success) {
        setParts(p => [...p, file])
        message.success(`Part ${data.parts_count} added`)
      } else {
        message.error(data.error || 'Failed to add part')
      }
    } finally {
      setLoading(false)
    }
  }

  const processSession = async () => {
    if (!sessionId) return message.error('No session started')
    setLoading(true)
    try {
      const res = await fetch(
        `https://rairo-pos-image-api.hf.space/process-receipt-session/${sessionId}`,
        { method: 'POST' }
      )
      const data = await res.json()
      if (data.success) {
        setProducts((data.data.items || []).map(defaultProduct))
        message.success('Session processed')
      } else {
        message.error(data.error || 'Failed to process session')
      }
    } finally {
      setLoading(false)
    }
  }

  const processBulkReceipts = async files => {
    setLoading(true)
    const formData = new FormData()
    files.forEach(f => formData.append('images', f))
    try {
      const res = await fetch(
        'https://rairo-pos-image-api.hf.space/bulk-process-receipts',
        { method: 'POST', body: formData }
      )
      const data = await res.json()
      if (data.success) {
        setBulkResults(data.results)
        setProducts(flattenItems(data.results).map(defaultProduct))
        message.success('Bulk processed')
      } else {
        message.error(data.error || 'Bulk processing failed')
      }
    } finally {
      setLoading(false)
    }
  }

  // --- SAVE TO FIRESTORE ---
  const saveAll = async values => {
    setLoading(true)
    try {
      for (let val of values.products) {
        await addDoc(collection(db, 'products'), {
          ...val,
          companyName,
          unitPrice: Number(val.sellingPrice),
          qty: Number(val.qty),
          type: val.type,
          unit: val.unit || 'item'
        })
      }
      message.success('Products saved')
      setProducts([])
      if (onComplete) onComplete()
    } catch (err) {
      message.error('Failed to save')
    } finally {
      setLoading(false)
    }
  }

  // --- RENDER ---

  const renderProductEditor = () => (
    <Form
      form={form}
      initialValues={{ products }}
      onFinish={vals => saveAll(vals)}
      autoComplete='off'
      style={{ width: '100%' }}
    >
      <Form.List name='products' initialValue={products}>
        {(fields, { add, remove }) => (
          <div>
            {fields.map((field, idx) =>
              isMobile ? (
                <Card
                  key={field.key}
                  style={{ marginBottom: 16 }}
                  size='small'
                  title={<span>{`Product #${idx + 1}`}</span>}
                  extra={
                    <Button danger onClick={() => remove(field.name)}>
                      Remove
                    </Button>
                  }
                >
                  <Form.Item
                    name={[field.name, 'name']}
                    label='Name'
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'type']}
                    label='Type'
                    rules={[{ required: true }]}
                  >
                    <Select>
                      <Option value='product'>Product</Option>
                      <Option value='service'>Service</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'sellingPrice']}
                    label='Selling Price'
                    rules={[{ required: true }]}
                  >
                    <InputNumber prefix='R' style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'qty']}
                    label='Qty'
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Card>
              ) : (
                <Row key={field.key} gutter={8} style={{ marginBottom: 8 }}>
                  <Col span={6}>
                    <Form.Item
                      name={[field.name, 'name']}
                      rules={[{ required: true }]}
                    >
                      <Input placeholder='Name' />
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item
                      name={[field.name, 'type']}
                      rules={[{ required: true }]}
                    >
                      <Select>
                        <Option value='product'>Product</Option>
                        <Option value='service'>Service</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name={[field.name, 'sellingPrice']}
                      rules={[{ required: true }]}
                    >
                      <InputNumber prefix='R' style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item
                      name={[field.name, 'qty']}
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={2}>
                    <Button danger onClick={() => remove(field.name)}>
                      Remove
                    </Button>
                  </Col>
                </Row>
              )
            )}
            {products.length === 0 && <div>No products loaded.</div>}
          </div>
        )}
      </Form.List>
      <Button
        htmlType='submit'
        type='primary'
        block
        disabled={loading || products.length === 0}
      >
        Save All Products
      </Button>
    </Form>
  )

  return (
    <Card
      style={{ maxWidth: 600, margin: 'auto', width: '100%' }}
      bodyStyle={{ padding: isMobile ? 12 : 24 }}
      title='Add Products via Receipt'
    >
      <Tabs activeKey={tab} onChange={setTab}>
        <Tabs.TabPane tab='Single' key='single'>
          <Upload
            accept='image/*'
            showUploadList={false}
            customRequest={({ file }) => processSingleReceipt(file)}
          >
            <Button icon={<UploadOutlined />} block loading={loading}>
              Upload/Scan Receipt
            </Button>
          </Upload>
        </Tabs.TabPane>
        <Tabs.TabPane tab='Multi-Part' key='multipart'>
          <Space direction='vertical' style={{ width: '100%' }}>
            {!sessionId && (
              <Button
                icon={<PlusOutlined />}
                block
                onClick={startSession}
                loading={loading}
              >
                Start Multipart Session
              </Button>
            )}
            {sessionId && (
              <>
                <Upload
                  accept='image/*'
                  showUploadList={false}
                  customRequest={({ file }) => addPart(file)}
                >
                  <Button icon={<UploadOutlined />} block loading={loading}>
                    Add Receipt Part
                  </Button>
                </Upload>
                <Button
                  type='primary'
                  block
                  onClick={processSession}
                  loading={loading}
                  style={{ marginTop: 8 }}
                >
                  Process Session
                </Button>
                <div>Parts uploaded: {parts.length}</div>
              </>
            )}
          </Space>
        </Tabs.TabPane>
        <Tabs.TabPane tab='Bulk' key='bulk'>
          <Upload
            accept='image/*'
            multiple
            showUploadList={false}
            customRequest={({ file, fileList }) =>
              processBulkReceipts(fileList.map(f => f.originFileObj || f))
            }
          >
            <Button icon={<UploadOutlined />} block loading={loading}>
              Upload Multiple Receipts
            </Button>
          </Upload>
        </Tabs.TabPane>
      </Tabs>

      {loading && <Spin style={{ margin: 20 }} />}

      {products.length > 0 && (
        <div style={{ marginTop: 24 }}>{renderProductEditor()}</div>
      )}
    </Card>
  )
}
