import React, { useEffect, useState } from 'react'
import {
  Card,
  Button,
  Tag,
  Modal,
  Input,
  Typography,
  Row,
  Col,
  message,
  Space,
  Grid,
  Empty,
  Table
} from 'antd'
import { ShopOutlined, DollarOutlined } from '@ant-design/icons'
import { db } from '../firebase'
import {
  collection,
  getDoc,
  getDocs,
  addDoc,
  doc,
  query,
  where,
  Timestamp
} from 'firebase/firestore'
import { useOutletContext } from 'react-router-dom'
import type { Teller, BranchExpected } from '../types/type'

const { Title, Text } = Typography
const { useBreakpoint } = Grid

// Utility: Get start/end of today as Firestore Timestamp
function getTodayRange () {
  const now = new Date()
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0
  )
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  )
  return {
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end)
  }
}

export default function CashInScreen () {
  const [messageApi, contextHolder] = message.useMessage()
  const { currentUser } = useOutletContext()
  const screens = useBreakpoint()
  const [adminBranches, setAdminBranches] = useState<string[]>([])
  const [companyName, setCompanyName] = useState('')
  const [tellers, setTellers] = useState<Teller[]>([])
  const [branchExpectedCash, setBranchExpectedCash] = useState<BranchExpected>(
    {}
  )
  const [tellerExpectedCash, setTellerExpectedCash] = useState<
    Record<string, number>
  >({})
  const [tellerBankExpected, setTellerBankExpected] = useState<
    Record<string, number>
  >({})
  const [tellerCreditExpected, setTellerCreditExpected] = useState<
    Record<string, number>
  >({})

  const [cashInModalVisible, setCashInModalVisible] = useState(false)
  const [selectedTeller, setSelectedTeller] = useState<Teller | null>(null)
  const [cashInForm, setCashInForm] = useState<{
    cash: string
    bank: string
    credit: string
  }>({
    cash: '',
    bank: '',
    credit: ''
  })
  const [branchSearch, setBranchSearch] = useState('')
  const [tellerSearch, setTellerSearch] = useState('')

  const hasTellerSalesToday = (tellerId: string) => {
    return (
      (tellerExpectedCash[tellerId] || 0) > 0 ||
      (tellerBankExpected[tellerId] || 0) > 0 ||
      (tellerCreditExpected[tellerId] || 0) > 0
    )
  }

  // Fetch user info, branches, tellers on mount
  useEffect(() => {
    async function fetchData () {
      if (!currentUser?.uid) return

      // 1. User info
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
      const userData = userDoc.data()
      const branches = userData?.branches || []
      setAdminBranches(branches)
      setCompanyName(userData?.companyName || '')

      console.log('Current User:', currentUser)
      console.log('User data from Firestore:', userData)
      console.log('Branches for admin:', branches)
      console.log('Company name:', userData?.companyName)

      // 2. Tellers for this company
      const tellersSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('companyName', '==', userData?.companyName),
          where('userRole', '==', 'teller')
        )
      )
      const tellersFiltered = tellersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Teller[]
      setTellers(tellersFiltered)
      console.log('Tellers loaded:', tellersFiltered)
    }
    fetchData()
  }, [currentUser])

  // Fetch today’s expected cash-in per branch (from sales)
  useEffect(() => {
    async function fetchBranchExpected () {
      if (!adminBranches.length) return
      const { start, end } = getTodayRange()
      const result: BranchExpected = {}

      // For each branch, sum cash sales for today
      for (const branch of adminBranches) {
        const salesQ = query(
          collection(db, 'sales'),
          where('branch', '==', branch),
          where('createdAt', '>=', start),
          where('createdAt', '<=', end)
        )
        const snap = await getDocs(salesQ)
        let cash = 0
        snap.forEach(doc => {
          const sale = doc.data()
          if (sale.paymentType === 'Cash') cash += sale.total
        })
        result[branch] = cash
        console.log(`Branch: ${branch} | Cash sales sum for today: R${cash}`)
      }
      setBranchExpectedCash(result)
    }
    fetchBranchExpected()
  }, [adminBranches])

  // Fetch expected cash-in per teller for today
  useEffect(() => {
    async function fetchTellerCashIn () {
      if (!tellers.length) return
      const { start, end } = getTodayRange()
      const expected: Record<string, number> = {}

      // For each teller, sum cash sales for today
      for (const teller of tellers) {
        const q = query(
          collection(db, 'sales'),
          where('tellerId', '==', teller.id),
          where('createdAt', '>=', start),
          where('createdAt', '<=', end),
          where('paymentType', '==', 'Cash')
        )
        const snap = await getDocs(q)
        let sum = 0
        snap.forEach(doc => {
          sum += doc.data().total || 0
        })
        expected[teller.id] = sum
        console.log(`Teller: ${teller.name} | Cash sales today: R${sum}`)
      }
      setTellerExpectedCash(expected)
    }
    fetchTellerCashIn()
  }, [tellers])

  useEffect(() => {
    async function fetchTellerBankAndCredit () {
      if (!tellers.length) return
      const { start, end } = getTodayRange()
      const bank: Record<string, number> = {}
      const credit: Record<string, number> = {}

      for (const teller of tellers) {
        // BANK
        const qBank = query(
          collection(db, 'sales'),
          where('tellerId', '==', teller.id),
          where('createdAt', '>=', start),
          where('createdAt', '<=', end),
          where('paymentType', '==', 'Bank')
        )
        const snapBank = await getDocs(qBank)
        let sumBank = 0
        snapBank.forEach(doc => {
          sumBank += doc.data().total || 0
        })
        bank[teller.id] = sumBank

        // CREDIT
        const qCredit = query(
          collection(db, 'sales'),
          where('tellerId', '==', teller.id),
          where('createdAt', '>=', start),
          where('createdAt', '<=', end),
          where('paymentType', '==', 'Credit')
        )
        const snapCredit = await getDocs(qCredit)
        let sumCredit = 0
        snapCredit.forEach(doc => {
          sumCredit += doc.data().total || 0
        })
        credit[teller.id] = sumCredit

        // Debug logs
        console.log(
          `Teller: ${teller.name} | Bank sales: R${sumBank} | Credit sales: R${sumCredit}`
        )
      }
      setTellerBankExpected(bank)
      setTellerCreditExpected(credit)
    }
    fetchTellerBankAndCredit()
  }, [tellers])

  // Branch summary array
  const branchData = adminBranches.map(branch => ({
    branch,
    expected: branchExpectedCash[branch] || 0
  }))

  const filteredBranchData = branchData.filter(
    b =>
      !branchSearch ||
      b.branch.toLowerCase().includes(branchSearch.toLowerCase())
  )

  // Teller list, optionally filtered
  const tellerData = tellers.filter(
    t =>
      (!tellerSearch ||
        t.name.toLowerCase().includes(tellerSearch.toLowerCase()) ||
        t.branch.toLowerCase().includes(tellerSearch.toLowerCase())) &&
      adminBranches.includes(t.branch) &&
      hasTellerSalesToday(t.id) // <- Only those with sales today
  )

  // Open cash-in modal for teller
  const openTellerModal = (teller: Teller) => {
    setSelectedTeller(teller)
    setCashInForm({ cash: '', bank: '', credit: '' })
    setCashInModalVisible(true)
  }

  // Save cash-in to cashIns collection
  const handleSubmit = async () => {
    try {
      if (!selectedTeller) return
      const expectedCash = tellerExpectedCash[selectedTeller.id] || 0
      const actualCash = parseFloat(cashInForm.cash) || 0
      const bank = parseFloat(cashInForm.bank) || 0
      const credit = parseFloat(cashInForm.credit) || 0

      let status: 'underpaid' | 'overpaid' | 'exact' = 'exact'
      if (actualCash < expectedCash) status = 'underpaid'
      else if (actualCash > expectedCash) status = 'overpaid'

      await addDoc(collection(db, 'cashIns'), {
        branch: selectedTeller.branch,
        tellerId: selectedTeller.id,
        tellerName: selectedTeller.name,
        cash: actualCash,
        bank,
        credit,
        expectedCashIn: expectedCash,
        status,
        type: 'cash',
        date: Timestamp.now(),
        companyName,
        adminId: currentUser.uid
      })
      messageApi.success(
        `Cash in recorded for ${selectedTeller.name} (${status})`
      )
      setCashInModalVisible(false)
      setSelectedTeller(null)
      setCashInForm({ cash: '', bank: '', credit: '' })
    } catch (error) {
      messageApi.error('Error saving cash in')
    }
  }

  return (
    <>
      {contextHolder}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 12 }}>
        <Title level={4} style={{ textAlign: 'center', marginBottom: 18 }}>
          Cash In Dashboard
        </Title>

        {/* Branch summary */}
        <Title level={5} style={{ marginBottom: 8 }}>
          Branch Summary
        </Title>
        <Row gutter={[16, 16]}>
          {filteredBranchData.length === 0 ? (
            <Col span={24}>
              <Empty description='No branches found' />
            </Col>
          ) : (
            filteredBranchData.map(branch => (
              <Col xs={12} sm={12} md={12} key={branch.branch}>
                <Card
                  size='small'
                  style={{ borderRadius: 10, minHeight: 120 }}
                  bodyStyle={{ padding: 18 }}
                >
                  <Space align='center' style={{ marginBottom: 10 }}>
                    <ShopOutlined style={{ fontSize: 28, color: '#1677ff' }} />
                    <Title level={5} style={{ margin: 0 }}>
                      {branch.branch}
                    </Title>
                  </Space>
                  <Row gutter={[8, 0]}>
                    <Col span={24}>
                      <Text>
                        Expected Cash In Today: <b>R{branch.expected}</b>
                      </Text>
                    </Col>
                  </Row>
                </Card>
              </Col>
            ))
          )}
        </Row>

        {/* Teller cash-in (table or cards) */}
        <Title level={5} style={{ marginTop: 32, marginBottom: 8 }}>
          Teller Cash-In
        </Title>
        <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
          <Col span={24}>
            <Input.Search
              placeholder='Search teller or branch...'
              allowClear
              value={tellerSearch}
              onChange={e => setTellerSearch(e.target.value)}
            />
          </Col>
        </Row>
        <div
          style={{
            maxHeight: 430, // or whatever fits your viewport nicely!
            overflowY: 'auto',
            paddingRight: 8,
            marginBottom: 24
          }}
        >
          {screens.md ? (
            <Table
              dataSource={tellerData}
              rowKey='id'
              pagination={{ pageSize: 8 }}
              columns={[
                {
                  title: 'Teller',
                  dataIndex: 'name',
                  key: 'name',
                  render: (name, record) => (
                    <span>
                      {name} <Tag>{record.branch}</Tag>
                    </span>
                  )
                },
                {
                  title: 'Expected Cash In',
                  key: 'expected',
                  render: (_, rec) => (
                    <span>R{tellerExpectedCash[rec.id] || 0}</span>
                  )
                },
                {
                  title: 'Action',
                  key: 'action',
                  align: 'center',
                  render: (_, rec) => (
                    <Button type='primary' onClick={() => openTellerModal(rec)}>
                      Record Cash-In
                    </Button>
                  )
                }
              ]}
            />
          ) : (
            <Row gutter={[10, 12]}>
              {tellerData.length === 0 ? (
                <Col span={24}>
                  <Empty description='No tellers found' />
                </Col>
              ) : (
                tellerData.map(item => (
                  <Col xs={24} key={item.id}>
                    <Card
                      style={{
                        borderRadius: 10,
                        background: '#fff',
                        marginBottom: 12
                      }}
                      bodyStyle={{ padding: 14 }}
                      onClick={() => openTellerModal(item)}
                      hoverable
                    >
                      <Row align='middle' justify='space-between'>
                        <Col>
                          <Text strong>{item.name}</Text>
                          <div style={{ color: '#888' }}>
                            Branch: {item.branch}
                          </div>
                          <div>
                            <b>Expected Cash In:</b> R
                            {tellerExpectedCash[item.id] || 0}
                          </div>
                        </Col>
                      </Row>
                      <Button
                        type='primary'
                        block
                        style={{ marginTop: 8 }}
                        onClick={e => {
                          e.stopPropagation()
                          openTellerModal(item)
                        }}
                      >
                        Record Cash-In
                      </Button>
                    </Card>
                  </Col>
                ))
              )}
            </Row>
          )}
        </div>

        {/* --- Cash-In Modal for Teller --- */}
        <Modal
          open={cashInModalVisible}
          title={selectedTeller ? `Cash In - ${selectedTeller.name}` : ''}
          onCancel={() => setCashInModalVisible(false)}
          footer={null}
          centered
          destroyOnClose
          width={350}
        >
          {selectedTeller && (
            <div>
              <Text strong>Branch: {selectedTeller.branch}</Text>
              <br />
              <Text>
                <b>
                  Expected Cash In: R
                  {tellerExpectedCash[selectedTeller.id] || 0}
                </b>
              </Text>
              <div style={{ margin: '10px 0 6px 0' }}>
                <Text>
                  <span style={{ color: '#1677ff' }}>Bank Sales:</span>{' '}
                  <b>R{tellerBankExpected[selectedTeller.id] || 0}</b>
                </Text>
                <br />
                <Text>
                  <span style={{ color: '#faad14' }}>Credit Sales:</span>{' '}
                  <b>R{tellerCreditExpected[selectedTeller.id] || 0}</b>
                </Text>
              </div>
              <Input
                type='number'
                min={0}
                placeholder='Cash Amount'
                value={cashInForm.cash}
                onChange={e =>
                  setCashInForm({ ...cashInForm, cash: e.target.value })
                }
                style={{ margin: '10px 0 18px 0' }}
              />
              <Row gutter={8}>
                <Col span={12}>
                  <Button block onClick={() => setCashInModalVisible(false)}>
                    Cancel
                  </Button>
                </Col>
                <Col span={12}>
                  <Button
                    type='primary'
                    block
                    onClick={handleSubmit}
                    disabled={!cashInForm.cash}
                  >
                    Submit
                  </Button>
                </Col>
              </Row>
            </div>
          )}
        </Modal>
      </div>
    </>
  )
}
