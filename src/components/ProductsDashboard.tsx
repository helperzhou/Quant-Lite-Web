import { Typography, Row, Col, Divider, Select, List, Card } from 'antd'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import {
  ThunderboltOutlined,
  ScissorOutlined,
  ShoppingCartOutlined,
  AppstoreOutlined,
  GiftOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { useState } from 'react'
import type { Product } from '../types/type'

const { Title, Text } = Typography

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']

type Props = {
  products: Product[]
}

const productIcon = (item?: Product) => {
  if (!item) return <GiftOutlined style={{ color: '#bcbcbc' }} />
  const name = (item.name || '').toLowerCase()
  if (item.type === 'service') {
    if (name.includes('electricity') || name.includes('airtime'))
      return <ThunderboltOutlined style={{ color: '#1890ff' }} />
    if (name.includes('haircut') || name.includes('barber'))
      return <ScissorOutlined style={{ color: '#1976d2' }} />
    return <AppstoreOutlined style={{ color: '#1890ff' }} />
  }
  if (name.includes('meal') || name.includes('food') || name.includes('rice'))
    return <AppstoreOutlined style={{ color: '#ff9800' }} />
  return <ShoppingCartOutlined style={{ color: '#1890ff' }} />
}

const asDisplayValue = (item: Product) =>
  item.type === 'service'
    ? Number(item.availableValue ?? 0)
    : Number(item.stock ?? item.currentStock ?? 0)
const asDisplayPrice = (item: Product) =>
  Number(item.unitPrice ?? item.price ?? 0)

// Allows for products without trend data; fallbacks to 0s
const getStockTrend = (item: Product, months: string[]) =>
  Array.isArray(item?.stockTrend) && item.stockTrend.length === months.length
    ? item.stockTrend
    : Array(months.length).fill(asDisplayValue(item))

const ProductStatisticsDashboard = ({ products }: Props) => {
  const [trendProduct, setTrendProduct] = useState(products[0]?.name || '')

  // Alerts & Suggestions
  const alerts = products.filter(p => asDisplayValue(p) <= 5)
  const suggestions = products
    .filter(p => asDisplayValue(p) < 10)
    .map(p => ({
      ...p,
      reason: 'Low stock/value, consider restocking'
    }))

  // Metrics
  const totalValue = products.reduce(
    (sum, p) => sum + asDisplayValue(p) * asDisplayPrice(p),
    0
  )
  const topProduct = [...products].sort(
    (a, b) => asDisplayValue(b) - asDisplayValue(a)
  )[0]
  const lowProduct = [...products].sort(
    (a, b) => asDisplayValue(a) - asDisplayValue(b)
  )[0]

  // Trends
  const selected = products.find(p => p.name === trendProduct)
  const lineData = selected
    ? months.map((_, i) => getStockTrend(selected, months)[i])
    : []

  // Bar Data (total for all products per month)
  const barData = months.map((_, i) =>
    products.reduce((sum, p) => getStockTrend(p, months)[i] + sum, 0)
  )

  // Top 3 for mini bar
  const topThree = [...products]
    .sort((a, b) => asDisplayValue(b) - asDisplayValue(a))
    .slice(0, 3)

  // Highcharts configs
  const miniBarOptions = {
    chart: { type: 'column', height: 180, backgroundColor: 'transparent' },
    title: { text: null },
    xAxis: {
      categories: topThree.map(p => p.name),
      labels: { style: { fontSize: '13px' } }
    },
    yAxis: { visible: false },
    legend: { enabled: false },
    credits: { enabled: false },
    series: [
      {
        data: topThree.map(p => asDisplayValue(p)),
        color: '#1976D2'
      }
    ]
  }

  const trendLineOptions = {
    chart: { type: 'areaspline', height: 230, backgroundColor: 'transparent' },
    title: { text: null },
    xAxis: {
      categories: months,
      labels: { style: { fontSize: '13px' } }
    },
    yAxis: { title: null, gridLineWidth: 0 },
    legend: { enabled: false },
    credits: { enabled: false },
    series: [
      {
        name: trendProduct,
        data: lineData,
        color: '#6C63FF',
        fillOpacity: 0.15,
        marker: { radius: 5 }
      }
    ]
  }

  const barChartOptions = {
    chart: { type: 'column', height: 240, backgroundColor: 'transparent' },
    title: { text: null },
    xAxis: { categories: months },
    yAxis: { title: { text: 'Stock/Value' } },
    credits: { enabled: false },
    series: [
      {
        name: 'Total Stock/Value',
        data: barData,
        color: '#6C63FF'
      }
    ]
  }

  return (
    <div>
      <Row gutter={10} justify='space-between' style={{ marginBottom: 18 }}>
        <Col span={8}>
          <Card size='small' style={{ textAlign: 'center', borderRadius: 12 }}>
            <div>{topProduct && productIcon(topProduct)}</div>
            <Text type='secondary' style={{ fontSize: 12 }}>
              Top Stock/Value
            </Text>
            <div style={{ fontWeight: 700 }}>{topProduct?.name || '-'}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size='small' style={{ textAlign: 'center', borderRadius: 12 }}>
            <AppstoreOutlined style={{ color: '#1890ff' }} />
            <Text type='secondary' style={{ fontSize: 12 }}>
              Total Value
            </Text>
            <div style={{ fontWeight: 700 }}>R{totalValue.toFixed(2)}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size='small' style={{ textAlign: 'center', borderRadius: 12 }}>
            <div>{lowProduct && productIcon(lowProduct)}</div>
            <Text type='secondary' style={{ fontSize: 12 }}>
              Low Stock/Value
            </Text>
            <div style={{ fontWeight: 700 }}>{lowProduct?.name || '-'}</div>
          </Card>
        </Col>
      </Row>
      <Divider style={{ margin: '16px 0' }}>
        Top Inventory/Service Levels
      </Divider>
      <HighchartsReact
        highcharts={Highcharts}
        options={miniBarOptions}
        containerProps={{ style: { width: '100%' } }}
      />

      <Divider style={{ margin: '18px 0' }}>Monthly Overview</Divider>
      <HighchartsReact
        highcharts={Highcharts}
        options={barChartOptions}
        containerProps={{ style: { width: '100%' } }}
      />
      <Divider>Trends</Divider>
      <Select
        showSearch
        virtual
        style={{
          width: '100%',
          maxWidth: 350,
          margin: '0 auto 18px auto',
          display: 'block'
        }}
        placeholder='Select Product'
        value={trendProduct}
        options={products.map(p => ({
          label: (
            <span>
              {productIcon(p)} {p.name}
            </span>
          ),
          value: p.name
        }))}
        onChange={setTrendProduct}
        filterOption={(input, option) =>
          (option?.label as any)?.props?.children?.[1]
            ?.toLowerCase()
            .includes(input.toLowerCase())
        }
        optionLabelProp='label'
      />
      <HighchartsReact
        highcharts={Highcharts}
        options={trendLineOptions}
        containerProps={{ style: { width: '100%' } }}
      />
      <Divider>Alerts</Divider>
      {alerts.length === 0 ? (
        <Text type='secondary'>No critical alerts.</Text>
      ) : (
        <List
          itemLayout='horizontal'
          dataSource={alerts}
          renderItem={(item: Product) => (
            <List.Item>
              <List.Item.Meta
                avatar={productIcon(item)}
                title={
                  <span style={{ color: '#E53935', fontWeight: 700 }}>
                    {item.name}
                  </span>
                }
                description={`Stock/value: ${asDisplayValue(item)}`}
              />
            </List.Item>
          )}
          style={{
            background: '#FDECEA',
            borderRadius: 8,
            padding: 12,
            marginBottom: 10
          }}
        />
      )}
      <Divider>Suggestions</Divider>
      {suggestions.length === 0 ? (
        <Text type='secondary'>No suggestions at this time.</Text>
      ) : (
        <List
          itemLayout='horizontal'
          dataSource={suggestions}
          renderItem={(s: Product & { reason: string }) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <ExclamationCircleOutlined
                    style={{ color: '#1976d2', fontSize: 22 }}
                  />
                }
                title={
                  <span style={{ color: '#1976d2', fontWeight: 700 }}>
                    {s.name}
                  </span>
                }
                description={s.reason}
              />
            </List.Item>
          )}
          style={{
            background: '#E3F2FD',
            borderRadius: 8,
            padding: 12,
            marginBottom: 10
          }}
        />
      )}
    </div>
  )
}

export default ProductStatisticsDashboard
