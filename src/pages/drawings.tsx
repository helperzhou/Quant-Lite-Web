import React, { useState, useEffect } from 'react'
import {
  Table,
  List,
  Tag,
  Typography,
  Spin,
  Button,
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Input,
  Row,
  Col,
  message as antdMessage
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useMediaQuery } from 'react-responsive'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  doc,
  runTransaction,
  Timestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import dayjs from 'dayjs'
import { useOutletContext } from 'react-router-dom'

const { Text } = Typography

export default function DrawingsPage () {
  const { currentUser } = useOutletContext()
  const [data, setData] = useState<any[]>([])
  const [branches, setBranches] = useState<string[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [filterDate, setFilterDate] = useState<any>(null)
  const [filterBranch, setFilterBranch] = useState<string | undefined>()
  const [modalSubtotal, setModalSubtotal] = useState(0)
  const [form] = Form.useForm()
  const isMobile = useMediaQuery({ maxWidth: 768 })
  const [msg, contextHolder] = antdMessage.useMessage()

  // Fetch branches from branches collection if admin
  // Fetch branches from users collection for admins
  useEffect(() => {
    async function fetchBranches () {
      if (!currentUser) return
      if (!currentUser?.companyName || currentUser.userRole !== 'admin') return
      const snap = await getDocs(
        query(
          collection(db, 'users'),
          where('companyName', '==', currentUser.companyName)
        )
      )
      // Get unique branch names (support both `branch` and `branchName` fields for safety)
      const branchNames = Array.from(
        new Set(
          snap.docs
            .map(d => d.data().branch || d.data().branchName)
            .filter(Boolean)
        )
      )
      setBranches(branchNames)
    }
    fetchBranches()
  }, [currentUser])

  // Fetch products
  useEffect(() => {
    async function fetchProducts () {
      if (!currentUser) return
      if (!currentUser?.companyName) return
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

  // Fetch drawings (admins see all, tellers see their own)
  useEffect(() => {
    if (!currentUser) return
    if (!currentUser?.companyName) return
    async function fetchDrawings () {
      setLoading(true)
      let q
      if (currentUser.userRole === 'admin') {
        q = query(
          collection(db, 'drawings'),
          where('companyName', '==', currentUser.companyName),
          orderBy('date', 'desc')
        )
      } else {
        q = query(
          collection(db, 'drawings'),
          where('companyName', '==', currentUser.companyName),
          where('drawnBy.uid', '==', currentUser.uid),
          orderBy('date', 'desc')
        )
      }
      const snap = await getDocs(q)
      let rows = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }))
      // Date filter
      if (filterDate) {
        const start = filterDate[0]?.startOf('day').toDate()
        const end = filterDate[1]?.endOf('day').toDate()
        rows = rows.filter(row => {
          const date = row.date?.toDate?.()
          return date >= start && date <= end
        })
      }
      // Branch filter (admin only)
      if (currentUser.userRole === 'admin' && filterBranch) {
        rows = rows.filter(row => row.branch === filterBranch)
      }
      setData(rows)
      setLoading(false)
    }
    fetchDrawings()
  }, [currentUser, filterDate, filterBranch, modalOpen])

  // --- SUBTOTAL LOGIC ---
  const updateSubtotal = () => {
    const { productId, quantity } = form.getFieldsValue([
      'productId',
      'quantity'
    ])
    const product = products.find(p => p.id === productId)
    const qty = Number(quantity)
    if (product && qty > 0) {
      setModalSubtotal(qty * (product.unitPrice ?? product.price ?? 0))
    } else {
      setModalSubtotal(0)
    }
  }

  // Clear subtotal when modal closes
  useEffect(() => {
    if (!modalOpen) setModalSubtotal(0)
  }, [modalOpen])

  // Modal form submission
  const handleAddDrawing = async (values: any) => {
    setSubmitting(true)
    const product = products.find(p => p.id === values.productId)
    if (!product) {
      msg.error('Invalid product.')
      setSubmitting(false)
      return
    }
    const drawQty = Number(values.quantity)
    const subtotal = drawQty * (product.unitPrice ?? product.price ?? 0)
    const prodRef = doc(db, 'products', product.id)
    try {
      await runTransaction(db, async tx => {
        const docSnap = await tx.get(prodRef)
        const currentQty = docSnap.data()?.qty ?? 0
        if (drawQty > currentQty) {
          throw new Error(`Only ${currentQty} units in stock.`)
        }
        tx.update(prodRef, { qty: currentQty - drawQty })
      })
      await addDoc(collection(db, 'drawings'), {
        productId: product.id,
        productName: product.name,
        quantity: drawQty,
        subtotal,
        reason: values.reason,
        date: Timestamp.fromDate(values.date.toDate()),
        drawnBy: {
          uid: currentUser.uid,
          name: currentUser.name,
          userRole: currentUser.userRole
        },
        branch:
          currentUser.userRole === 'admin'
            ? values.branch || ''
            : currentUser.branch || '',
        companyName: currentUser.companyName || ''
      })
      await addDoc(collection(db, 'expenses'), {
        name: `Product Draw: ${product.name}`,
        amount: subtotal,
        type: 'Drawing',
        createdAt: Timestamp.now(),
        branch:
          currentUser.userRole === 'admin'
            ? values.branch || ''
            : currentUser.branch || '',
        companyName: currentUser.companyName || '',
        notes: values.reason
      })
      msg.success('Drawing recorded successfully!')
      form.resetFields()
      setModalOpen(false)
      setModalSubtotal(0)
    } catch (err: any) {
      msg.error(err.message || 'Failed to record drawing.')
    } finally {
      setSubmitting(false)
    }
  }

  // Table columns
  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date: any) => dayjs(date?.toDate?.()).format('YYYY-MM-DD HH:mm')
    },
    { title: 'Product', dataIndex: 'productName', key: 'productName' },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity' },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      key: 'subtotal',
      render: (subtotal: any) =>
        typeof subtotal === 'number'
          ? `R ${subtotal.toLocaleString('en-ZA', {
              minimumFractionDigits: 2
            })}`
          : '-'
    },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', ellipsis: true },
    {
      title: 'Drawn By',
      dataIndex: 'drawnBy',
      key: 'drawnBy',
      render: (d: any) => (
        <span>
          <Text strong>{d?.name}</Text>
          {d?.userRole ? (
            <Tag color={d.userRole === 'admin' ? 'geekblue' : 'green'}>
              {d.userRole}
            </Tag>
          ) : null}
        </span>
      )
    },
    { title: 'Branch', dataIndex: 'branch', key: 'branch' }
  ]

  // List renderer (mobile)
  const renderItem = (item: any) => (
    <List.Item key={item.id}>
      <List.Item.Meta
        title={
          <div>
            <Text strong>{item.productName}</Text>
            <Tag>{item.quantity}</Tag>
            <span style={{ float: 'right' }}>
              {dayjs(item.date.toDate()).format('MMM D, YYYY HH:mm')}
            </span>
          </div>
        }
        description={
          <div>
            <div>
              <b>Subtotal:</b>{' '}
              {typeof item.subtotal === 'number'
                ? `R ${item.subtotal.toLocaleString('en-ZA', {
                    minimumFractionDigits: 2
                  })}`
                : '-'}
            </div>
            <div>
              <b>Drawn By:</b> {item.drawnBy?.name}{' '}
              <Tag
                color={
                  item.drawnBy?.userRole === 'admin' ? 'geekblue' : 'green'
                }
              >
                {item.drawnBy?.userRole}
              </Tag>
            </div>
            <div>
              <b>Branch:</b> {item.branch}
            </div>
            {item.reason && (
              <div>
                <b>Reason:</b> {item.reason}
              </div>
            )}
          </div>
        }
      />
    </List.Item>
  )

  // Filter controls
  const filterControls = (
    <Row gutter={16} style={{ marginBottom: 16 }}>
      <Col>
        <DatePicker.RangePicker
          onChange={range => setFilterDate(range)}
          allowClear
        />
      </Col>
      {currentUser.userRole === 'admin' && (
        <Col>
          <Select
            style={{ minWidth: 120 }}
            placeholder='Branch'
            allowClear
            value={filterBranch}
            onChange={val => setFilterBranch(val)}
            options={branches.map(b => ({ label: b, value: b }))}
          />
        </Col>
      )}
    </Row>
  )

  return (
    <div style={{ margin: isMobile ? 8 : 32 }}>
      {contextHolder}
      <Row gutter={[8, 8]} align='middle' style={{ marginBottom: 16 }}>
        <Col flex='auto'>
          <Typography.Title level={4}>Drawings</Typography.Title>
        </Col>
        <Col>
          <Button
            type='primary'
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
          >
            {currentUser.userRole === 'admin' ? 'Add New' : 'Record Drawing'}
          </Button>
        </Col>
      </Row>
      {filterControls}
      {loading ? (
        <Spin />
      ) : isMobile ? (
        <List dataSource={data} renderItem={renderItem} bordered size='small' />
      ) : (
        <Table
          columns={columns}
          dataSource={data}
          rowKey='id'
          pagination={{ pageSize: 10 }}
          bordered
          size='small'
        />
      )}

      {/* Add New Modal */}
      <Modal
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setModalSubtotal(0)
        }}
        title='Record Drawing'
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout='vertical'
          onFinish={handleAddDrawing}
          initialValues={{
            date: dayjs(),
            branch:
              currentUser.userRole !== 'admin' ? currentUser.branch : undefined
          }}
          onValuesChange={updateSubtotal}
        >
          <Form.Item name='date' label='Date' rules={[{ required: true }]}>
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
          {/* Subtotal/Total display */}
          <div
            style={{
              textAlign: 'right',
              fontWeight: 600,
              fontSize: 18,
              color: '#135200',
              marginBottom: 12
            }}
          >
            Total:{' '}
            <span>{`R ${modalSubtotal.toLocaleString('en-ZA', {
              minimumFractionDigits: 2
            })}`}</span>
          </div>
          <Form.Item
            name='reason'
            label='Reason'
            rules={[{ required: true, message: 'Reason is required' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder='e.g. used in kitchen, store cleaning, etc.'
            />
          </Form.Item>
          {currentUser.userRole === 'admin' ? (
            <Form.Item
              name='branch'
              label='Branch'
              rules={[{ required: true, message: 'Branch is required' }]}
            >
              <Select
                showSearch
                placeholder='Select branch'
                options={branches.map(b => ({ label: b, value: b }))}
                allowClear
              />
            </Form.Item>
          ) : (
            <Form.Item label='Branch'>
              <Input value={currentUser.branch} disabled />
            </Form.Item>
          )}
          <Form.Item>
            <Button type='primary' htmlType='submit' block loading={submitting}>
              {currentUser.userRole === 'admin' ? 'Record Drawing' : 'Submit'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
