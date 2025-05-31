import { useEffect, useState } from 'react'
import {
  Row,
  Col,
  Card,
  Avatar,
  Typography,
  Tabs,
  Modal,
  Badge,
  Spin,
  Table,
  Grid
} from 'antd'
import {
  UserOutlined,
  ShopOutlined,
  TeamOutlined,
  DollarOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { auth, db } from '../../firebase'
import {
  doc,
  getDoc,
  getDocs,
  collection,
  where,
  query,
  Timestamp
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TabPane } = Tabs
const { useBreakpoint } = Grid

// Hide scrollbars visually, but allow scroll (for Chrome, Firefox, Edge, etc)
const noScrollbarStyle = (screens) => ({
  maxHeight: screens.xs ? 340 : 440,
  minHeight: 180, // So both tabs are visually balanced when lists are short
  overflowY: 'auto',
  marginBottom: 8,
  paddingRight: 4,
  scrollbarWidth: 'none',
  msOverflowStyle: 'none'
})

export default function AdminDashboard () {
  const screens = useBreakpoint()
  const [branchNames, setBranchNames] = useState<string[]>([])
  const [tellers, setTellers] = useState<any[]>([])
  const [credits, setCredits] = useState<any[]>([])
  const [salesTotals, setSalesTotals] = useState<{ [branch: string]: number }>(
    {}
  )
  const [salesList, setSalesList] = useState<any[]>([])
  const [salesByTeller, setSalesByTeller] = useState<{
    [tellerId: string]: any[]
  }>({})
  const [productCount, setProductCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedTeller, setSelectedTeller] = useState<any>(null)
  const [selectedCredit, setSelectedCredit] = useState<any>(null)
  const [expandedSaleRowKeys, setExpandedSaleRowKeys] = useState<string[]>([])

  useEffect(() => {
    setLoading(true)
    const unsub = onAuthStateChanged(auth, async user => {
      if (!user?.uid) {
        setLoading(false)
        return
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        const branches = userDoc.data()?.branches || []
        setBranchNames(branches)
        const companyName = userDoc.data()?.companyName
        const [tellerSnap, creditSnap, productSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'users'),
              where('userRole', '==', 'teller'),
              where('companyName', '==', companyName)
            )
          ),
          getDocs(
            query(
              collection(db, 'credits'),
              where('companyName', '==', companyName)
            )
          ),
          getDocs(
            query(
              collection(db, 'products'),
              where('companyName', '==', companyName)
            )
          )
        ])
        setTellers(tellerSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setCredits(creditSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setProductCount(productSnap.size)

        // Fetch today's sales
        const todayStart = dayjs().startOf('day').toDate()
        const todayEnd = dayjs().endOf('day').toDate()
        const salesSnap = await getDocs(
          query(
            collection(db, 'sales'),
            where('companyName', '==', companyName),
            where('createdAt', '>=', Timestamp.fromDate(todayStart)),
            where('createdAt', '<=', Timestamp.fromDate(todayEnd))
          )
        )

        let branchSales = {}
        let todaySalesArr = []
        branches.forEach(branch => {
          branchSales[branch] = 0
        })
        salesSnap.forEach(doc => {
          const sale = doc.data()
          const branch = sale.branch || 'Unknown'
          branchSales[branch] = (branchSales[branch] || 0) + (sale.total || 0)
          todaySalesArr.push({ id: doc.id, ...sale })
        })
        setSalesTotals(branchSales)
        setSalesList(todaySalesArr)

        // Group sales by tellerId
        const grouped: { [tellerId: string]: any[] } = {}
        todaySalesArr.forEach(sale => {
          const tellerKey = sale.tellerId || 'Unknown'
          if (!grouped[tellerKey]) grouped[tellerKey] = []
          grouped[tellerKey].push(sale)
        })
        setSalesByTeller(grouped)
      } catch (err) {
        console.log(err)
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [])

  // Table columns for breakdown of teller's sales in modal
  const tellerSalesColumns = [
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: any) =>
        val && val.seconds ? dayjs.unix(val.seconds).format('HH:mm') : ''
    },
    {
      title: 'Branch',
      dataIndex: 'branch',
      key: 'branch'
    },
    {
      title: 'Amount',
      dataIndex: 'total',
      key: 'total',
      render: (amt: number) => `R${amt || 0}`
    },
    {
      title: 'Payment',
      dataIndex: 'paymentType',
      key: 'paymentType'
    }
  ]

  // Expand sales row to show products
  const renderSaleExpand = (sale: any) => (
    <Table
      columns={[
        { title: 'Product', dataIndex: 'name', key: 'name' },
        { title: 'Qty', dataIndex: 'quantity', key: 'quantity' },
        {
          title: 'Price',
          dataIndex: 'sellingPrice',
          key: 'sellingPrice',
          render: (price: number) => `R${price}`
        },
        {
          title: 'Subtotal',
          dataIndex: 'subtotal',
          key: 'subtotal',
          render: (_: any, item: any) =>
            `R${item.subtotal || item.sellingPrice * item.quantity}`
        }
      ]}
      dataSource={Array.isArray(sale.cart) ? sale.cart : []}
      size='small'
      pagination={false}
      rowKey={r => r.id || r.name + (r.sellingPrice || '')}
    />
  )

  return (
    <div className='p-4' style={{ maxWidth: 900, margin: '0 auto' }}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <Row align='middle' gutter={16}>
              <Col>
                <Avatar
                  icon={<DollarOutlined />}
                  style={{ backgroundColor: '#4F8EF7' }}
                  size={48}
                />
              </Col>
              <Col>
                <Title level={5}>Sales Today</Title>
                <Text>
                  {branchNames
                    .map(branch => `${branch}: R${salesTotals[branch] || 0}`)
                    .join(' | ')}
                </Text>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={12} sm={12} md={12} lg={12}>
          <Card>
            <Row align='middle' gutter={16}>
              <Col>
                <Avatar
                  icon={<ShopOutlined />}
                  style={{ backgroundColor: '#F7B731' }}
                  size={36}
                />
              </Col>
              <Col>
                <Title level={5}>Products</Title>
                <Text>{productCount}</Text>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={12} sm={12} md={12} lg={12}>
          <Card>
            <Row align='middle' gutter={16}>
              <Col>
                <Avatar
                  icon={<TeamOutlined />}
                  style={{ backgroundColor: '#44C2A6' }}
                  size={36}
                />
              </Col>
              <Col>
                <Title level={5}>Tellers</Title>
                <Text>{tellers.length}</Text>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Tabs defaultActiveKey='1' className='mt-6'>
        {/* Today's Sales Tab */}
        <TabPane
          tab={
            <span>
              <UserOutlined /> Today's Sales
            </span>
          }
          key='1'
        >
          {loading ? (
            <Spin />
          ) : Object.keys(salesByTeller).length === 0 ? (
            <div style={{ textAlign: 'center', color: '#aaa', marginTop: 24 }}>
              No sales today.
            </div>
          ) : (
            <div
              className='no-scrollbar'
              style={noScrollbarStyle(screens)}
            >
              {/* List each teller ONCE */}
              {Object.entries(salesByTeller).map(([tellerId, tellerSales]) => {
                const tellerInfo = tellers.find(t => t.id === tellerId) || {}
                const name =
                  tellerInfo.name ||
                  tellerSales[0]?.tellerName ||
                  tellerId ||
                  'Teller'
                const branch = tellerInfo.branch || tellerSales[0]?.branch || ''
                const avatarColor = '#4F8EF7'
                return (
                  <Card
                    key={tellerId}
                    className='mb-4 hover:shadow-md cursor-pointer'
                    onClick={() => {
                      setSelectedTeller({
                        tellerId,
                        name,
                        branch,
                        sales: tellerSales
                      })
                      setSelectedCredit(null)
                      setModalVisible(true)
                      setExpandedSaleRowKeys([])
                    }}
                  >
                    <Card.Meta
                      avatar={
                        <Avatar
                          icon={<UserOutlined />}
                          style={{ backgroundColor: avatarColor }}
                        />
                      }
                      title={name}
                      description={`Branch: ${branch} | Sales: R${tellerSales.reduce(
                        (sum, s) => sum + (s.total || 0),
                        0
                      )} | Count: ${tellerSales.length}`}
                    />
                  </Card>
                )
              })}
            </div>
          )}
        </TabPane>

        {/* Credits Tab */}
        <TabPane
          tab={
            <span>
              <ExclamationCircleOutlined /> Outstanding Credit
            </span>
          }
          key='2'
        >
          {loading ? (
            <Spin />
          ) : credits.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#aaa', marginTop: 24 }}>
              No credits today.
            </div>
          ) : (
            <div
              className='no-scrollbar'
              style={noScrollbarStyle(screens)}
            >
              {credits.map(credit => (
                <Card
                  key={credit.id}
                  className='mb-4 hover:shadow-md cursor-pointer'
                  onClick={() => {
                    setSelectedCredit(credit)
                    setSelectedTeller(null)
                    setModalVisible(true)
                  }}
                >
                  <Card.Meta
                    avatar={
                      <Avatar
                        icon={<ExclamationCircleOutlined />}
                        style={{
                          backgroundColor:
                            credit.status === 'Overdue' ? '#D32F2F' : '#FFA726'
                        }}
                      />
                    }
                    title={credit.name || credit.customer}
                    description={
                      `R${credit.amountDue || credit.amount} • Due ` +
                      (credit.dueDate && credit.dueDate.seconds
                        ? dayjs.unix(credit.dueDate.seconds).format('YYYY-MM-DD')
                        : credit.dueDate)
                    }
                  />
                  <Badge.Ribbon
                    text={credit.status || ''}
                    color={credit.status === 'Overdue' ? 'red' : 'orange'}
                  ></Badge.Ribbon>
                </Card>
              ))}
            </div>
          )}
        </TabPane>
      </Tabs>

      {/* Details Modal */}
      <Modal
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setSelectedTeller(null)
          setSelectedCredit(null)
          setExpandedSaleRowKeys([])
        }}
        footer={null}
        centered
        width={screens && screens.xs ? 350 : 650}
      >
        {/* Teller sales details */}
        {selectedTeller && (
          <div className='text-center'>
            <Avatar
              size={64}
              icon={<UserOutlined />}
              style={{
                backgroundColor: '#4F8EF7'
              }}
            />
            <Title level={4} className='mt-3'>
              {selectedTeller.name}
            </Title>
            <Text>
              Branch: {selectedTeller.branch}
              <br />
              Total Sales: R
              {selectedTeller.sales.reduce((sum, s) => sum + (s.total || 0), 0)}
              <br />
              Number of Sales: {selectedTeller.sales.length}
            </Text>
            <div style={{ marginTop: 24 }}>
              <Title level={5} style={{ textAlign: 'left' }}>
                Sales Breakdown
              </Title>
              <Table
                columns={tellerSalesColumns}
                dataSource={selectedTeller.sales}
                size='small'
                pagination={screens.md ? { pageSize: 7 } : false}
                rowKey={r => r.id}
                expandable={{
                  expandedRowRender: renderSaleExpand,
                  rowExpandable: record =>
                    Array.isArray(record.cart) && record.cart.length > 0,
                  expandedRowKeys: expandedSaleRowKeys,
                  onExpand: (expanded, record) => {
                    setExpandedSaleRowKeys(expanded ? [record.id] : [])
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Credit details */}
        {selectedCredit && (
          <div className='text-center'>
            <Avatar
              size={64}
              icon={<ExclamationCircleOutlined />}
              style={{
                backgroundColor:
                  selectedCredit.status === 'Overdue' ? '#D32F2F' : '#FFA726'
              }}
            />
            <Title level={4} className='mt-3'>
              {selectedCredit.name || selectedCredit.customer}
            </Title>
            <Text>
              <div>
                Amount Due: <b>R{selectedCredit.amountDue || selectedCredit.amount}</b>
              </div>
              <div>
                Due Date:{' '}
                <b>
                  {selectedCredit.dueDate && selectedCredit.dueDate.seconds
                    ? dayjs.unix(selectedCredit.dueDate.seconds).format('YYYY-MM-DD')
                    : selectedCredit.dueDate || 'N/A'}
                </b>
              </div>
              <div>
                Status:{' '}
                <b style={{ color: selectedCredit.status === 'Overdue' ? '#D32F2F' : '#FFA726' }}>
                  {selectedCredit.status}
                </b>
              </div>
              {Array.isArray(selectedCredit.products) && selectedCredit.products.length > 0 && (
                <>
                  <div style={{ marginTop: 18, textAlign: 'left' }}>
                    <Title level={5}>Products</Title>
                    <Table
                      columns={[
                        { title: 'Product', dataIndex: 'name', key: 'name' },
                        { title: 'Qty', dataIndex: 'quantity', key: 'quantity' },
                        {
                          title: 'Unit Price',
                          dataIndex: 'sellingPrice',
                          key: 'sellingPrice',
                          render: (v: number) => `R${v}`
                        },
                        {
                          title: 'Subtotal',
                          dataIndex: 'subtotal',
                          key: 'subtotal',
                          render: (_: any, r: any) =>
                            `R${r.subtotal || r.sellingPrice * r.quantity}`
                        }
                      ]}
                      dataSource={selectedCredit.products}
                      size='small'
                      pagination={false}
                      rowKey={r => r.id || r.name + (r.sellingPrice || '')}
                    />
                  </div>
                </>
              )}
              {selectedCredit.description && (
                <div style={{ marginTop: 12, color: '#888' }}>
                  {selectedCredit.description}
                </div>
              )}
            </Text>
          </div>
        )}
      </Modal>

      {/* Hide scrollbars visually, but allow scroll */}
      <style>
        {`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        `}
      </style>
    </div>
  )
}
