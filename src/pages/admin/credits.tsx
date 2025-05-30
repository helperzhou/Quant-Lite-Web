import React, { useEffect, useState } from 'react'
import {
  Card,
  Tabs,
  Tag,
  Button,
  Modal,
  Input,
  Spin,
  Typography,
  message,
  Row,
  Col
} from 'antd'
import { db } from '../../firebase'
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore'
import { UserOutlined, SearchOutlined } from '@ant-design/icons'

const { Title, Text } = Typography
type Credit = {
  id: string
  name: string
  amountDue: number
  paidAmount: number
  dueDate: string // or Date
  creditScore: number
}

const CreditPaymentsScreen = () => {
  const [tab, setTab] = useState('payments')
  const [credits, setCredits] = useState<Credit[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCredit, setSelectedCredit] = useState(null)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [customerModal, setCustomerModal] = useState(false)
  const [searchText, setSearchText] = useState('')

  // Fetch credits from Firestore
  useEffect(() => {
    const fetchCredits = async () => {
      setLoading(true)
      try {
        const snap = await getDocs(collection(db, 'credits'))
        setCredits(
          snap.docs.map(doc => ({ ...(doc.data() as Credit), id: doc.id }))
        )
      } catch (error: any) {
        message.error('Failed to load credits: ' + error.message)
      }
      setLoading(false)
    }
    fetchCredits()
  }, [])

  // Customers
  const customers = [...new Set(credits.map(c => c.name?.trim()))].sort()
  const filteredCustomers = customers.filter(c =>
    c?.toLowerCase().includes(searchText.toLowerCase())
  )

  // Filtered credits for history tab
  const filteredCredits = selectedCustomer
    ? credits
        .filter(
          c =>
            c.name?.trim().toLowerCase() ===
            selectedCustomer?.trim().toLowerCase()
        )
        .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
    : []

  // Payment logic
  const openModal = credit => {
    setSelectedCredit(credit)
    setPaymentAmount('')
    setModalVisible(true)
  }

  const handlePayment = async () => {
    const payAmount = parseFloat(paymentAmount)
    if (
      !payAmount ||
      payAmount <= 0 ||
      payAmount > selectedCredit.amountDue - selectedCredit.paidAmount
    ) {
      message.warning('Invalid payment amount')
      return
    }
    try {
      const newPaid = selectedCredit.paidAmount + payAmount
      const remaining = selectedCredit.amountDue - newPaid
      const scoreChange = remaining <= 0 ? 5 : -2

      await updateDoc(doc(db, 'credits', selectedCredit.id), {
        paidAmount: newPaid,
        creditScore: selectedCredit.creditScore + scoreChange
      })
      // Refresh credits
      const snap = await getDocs(collection(db, 'credits'))
      setCredits(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })))
      setModalVisible(false)
      message.success('Payment recorded')
    } catch (error) {
      message.error('Payment failed: ' + error.message)
    }
  }

  // Credit score color
  const getCreditScoreColor = score => {
    if (score >= 75) return 'green'
    if (score >= 70) return 'gold'
    return 'red'
  }

  // Due status chip
  const dueStatus = credit => {
    const today = new Date().toISOString().slice(0, 10)
    if (credit.dueDate < today && credit.amountDue > credit.paidAmount)
      return ['Overdue', 'red']
    if (credit.dueDate === today) return ['Due Today', 'gold']
    return ['On Time', 'green']
  }

  // Responsive Card Style
  const cardStyle = {
    marginBottom: 16,
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    cursor: 'pointer'
  }

  return (
    <div style={{ padding: 12, maxWidth: 480, margin: '0 auto' }}>
      <Title level={4} style={{ textAlign: 'center', marginBottom: 8 }}>
        Credit Payments
      </Title>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        centered
        items={[
          { key: 'payments', label: 'Payments' },
          { key: 'history', label: 'History' }
        ]}
        style={{ marginBottom: 18 }}
      />

      <div style={{ minHeight: 380 }}>
        {tab === 'payments' ? (
          loading ? (
            <div style={{ textAlign: 'center', marginTop: 40 }}>
              <Spin />
            </div>
          ) : credits.length === 0 ? (
            <Text
              type='secondary'
              style={{ display: 'block', marginTop: 40, textAlign: 'center' }}
            >
              No credits found.
            </Text>
          ) : (
            credits.map(credit => {
              const remainingDue = (
                credit.amountDue - credit.paidAmount
              ).toFixed(2)
              const [status, color] = dueStatus(credit)
              return (
                <Card
                  key={credit.id}
                  style={cardStyle}
                  onClick={() => openModal(credit)}
                  bodyStyle={{ padding: 16 }}
                >
                  <Row align='middle' wrap={false}>
                    <Col flex='auto'>
                      <Text strong style={{ color: '#111' }}>
                        {credit.name}
                      </Text>
                      <div>
                        Amount Due: <b>R{remainingDue}</b>
                      </div>
                      <div>Due: {credit.dueDate}</div>
                    </Col>
                    <Col>
                      <Tag
                        color={getCreditScoreColor(credit.creditScore)}
                        style={{ marginBottom: 5 }}
                      >
                        {credit.creditScore}
                      </Tag>
                      <Tag color={color}>{status}</Tag>
                    </Col>
                  </Row>
                </Card>
              )
            })
          )
        ) : (
          <>
            {/* Customer Picker */}
            <Card
              style={{
                ...cardStyle,
                padding: 8,
                cursor: 'pointer',
                marginBottom: 16
              }}
              onClick={() => setCustomerModal(true)}
            >
              <Row align='middle'>
                <Col>
                  <UserOutlined style={{ fontSize: 18, marginRight: 8 }} />
                  {selectedCustomer
                    ? `Customer: ${selectedCustomer}`
                    : 'Select Customer'}
                </Col>
                <Col flex='auto' style={{ textAlign: 'right' }}>
                  <SearchOutlined />
                </Col>
              </Row>
            </Card>

            {/* Credit History */}
            {selectedCustomer && filteredCredits.length > 0 ? (
              filteredCredits.map(c => {
                const [status, color] = dueStatus(c)
                return (
                  <Card
                    key={`${c.id}-${c.dueDate}`}
                    style={cardStyle}
                    bodyStyle={{ padding: 16 }}
                  >
                    <Row align='middle' wrap={false}>
                      <Col flex='auto'>
                        <Text strong>{c.name}</Text>
                        <div>
                          Amount Due: <b>R{c.amountDue}</b>
                        </div>
                        <div>
                          Paid: <b>R{c.paidAmount}</b>
                        </div>
                        <div>Due Date: {c.dueDate}</div>
                      </Col>
                      <Col>
                        <Tag
                          color={getCreditScoreColor(c.creditScore)}
                          style={{ marginBottom: 5 }}
                        >
                          {c.creditScore}
                        </Tag>
                        <Tag color={color}>{status}</Tag>
                      </Col>
                    </Row>
                  </Card>
                )
              })
            ) : (
              <Text
                type='secondary'
                style={{ display: 'block', marginTop: 40, textAlign: 'center' }}
              >
                {selectedCustomer
                  ? 'No previous credits found.'
                  : 'Please select a customer.'}
              </Text>
            )}
          </>
        )}
      </div>

      {/* Payment Modal */}
      <Modal
        open={modalVisible}
        centered
        footer={null}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        width={340}
        bodyStyle={{ padding: 24 }}
      >
        {selectedCredit && (
          <>
            <Title level={5} style={{ marginBottom: 4 }}>
              Pay {selectedCredit.name}
            </Title>
            <Text>
              Remaining:{' '}
              <b>
                R
                {(selectedCredit.amountDue - selectedCredit.paidAmount).toFixed(
                  2
                )}
              </b>
            </Text>
            <div style={{ margin: '12px 0' }}>
              <Tag color={getCreditScoreColor(selectedCredit.creditScore)}>
                {selectedCredit.creditScore}
              </Tag>
            </div>
            <Input
              type='number'
              placeholder='Payment Amount'
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value)}
              style={{ margin: '12px 0 6px 0' }}
              min={0}
            />
            <Button type='primary' block onClick={handlePayment}>
              Confirm Payment
            </Button>
          </>
        )}
      </Modal>

      {/* Customer Selector Modal */}
      <Modal
        open={customerModal}
        centered
        footer={null}
        onCancel={() => setCustomerModal(false)}
        destroyOnClose
        width={340}
        bodyStyle={{ padding: 20 }}
      >
        <Title level={5} style={{ marginBottom: 12 }}>
          Select Customer
        </Title>
        <Input
          placeholder='Search by name...'
          value={searchText}
          allowClear
          onChange={e => setSearchText(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <div style={{ maxHeight: 250, overflowY: 'auto' }}>
          {filteredCustomers.map(item => (
            <Card
              key={item}
              style={{ marginBottom: 8, cursor: 'pointer', padding: 8 }}
              bodyStyle={{ padding: 10 }}
              onClick={() => {
                setSelectedCustomer(item)
                setCustomerModal(false)
              }}
            >
              <Text>{item}</Text>
            </Card>
          ))}
          {!filteredCustomers.length && (
            <Text type='secondary'>No customers found.</Text>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default CreditPaymentsScreen
