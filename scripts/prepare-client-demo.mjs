/**
 * Copies local business data into an isolated client-demo database. Never drops a database,
 * never calls payment/email/courier providers, and never overwrites an occupied destination.
 * Run from the repository root: node --import tsx scripts/prepare-client-demo.mjs prepare
 * Then: node --import tsx scripts/prepare-client-demo.mjs publish
 * The private target URI is read from .local/client-demo.env, never logged.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import console from 'node:console';
import { URL } from 'node:url';

const { MongoClient, ObjectId, BSON } = mongoose.mongo;
const work = path.resolve('.local/client-demo');
const sourceEnv = dotenv.parse(await fs.readFile('apps/api/.env'));
const privateEnv = dotenv.parse(await fs.readFile('.local/client-demo.env'));
const stageUri = 'mongodb://127.0.0.1:27018/megha_client_demo_stage?replicaSet=megha';
const version = 'megha-client-demo-v1';
const runId = new ObjectId(createHash('sha256').update(version).digest('hex').slice(0, 24));
const excluded = new Set(['sessions', 'passwordresets', 'ratebuckets', 'emails']);
const stamp = new Date();
const day = 86400000;
const ago = (days) => new Date(stamp.getTime() - days * day);
const id = (key) =>
  new ObjectId(
    createHash('sha256')
      .update(version + ':' + key)
      .digest('hex')
      .slice(0, 24),
  );
const serial = (n) => String(n + 1).padStart(3, '0');
const snapshotFile = path.join(work, 'source-backup.ejson');
const stagedFile = path.join(work, 'prepared-demo.ejson');
const safeError = (error) =>
  String(error.message).replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, '[redacted URI]');

async function snapshot(db) {
  const result = {};
  for (const { name, type } of await db.listCollections().toArray()) {
    if (type !== 'collection' || name.startsWith('system.') || name === 'demo_runs') continue;
    result[name] = {
      indexes: await db.collection(name).listIndexes().toArray(),
      documents: await db.collection(name).find({}).toArray(),
    };
  }
  return result;
}

async function restoreEmpty(db, data, digest) {
  const marker = await db.collection('demo_runs').findOne({ _id: runId });
  if (marker) {
    assert.equal(
      marker.digest,
      digest,
      'Destination contains a different demo snapshot. Refusing overwrite.',
    );
    assert.equal(
      marker.status,
      'COMPLETE',
      'Previous import was interrupted. Inspect it before retrying.',
    );
    console.log(db.databaseName + ': this snapshot is already imported; no records overwritten.');
    return;
  }
  for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
    assert.equal(
      await db.collection(name).countDocuments(),
      0,
      'Destination is not empty. Refusing to overwrite collection: ' + name,
    );
  }
  // Indexes and empty collections must exist before the multi-document transaction.
  for (const [name, group] of Object.entries(data)) {
    if (excluded.has(name)) continue;
    if (!(await db.listCollections({ name }).toArray()).length) await db.createCollection(name);
    for (const index of group.indexes) {
      if (index.name === '_id_') continue;
      const { key, v: _v, ns: _ns, ...options } = index;
      await db.collection(name).createIndex(key, options);
    }
  }
  const session = db.client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const [name, group] of Object.entries(data)) {
        if (!excluded.has(name) && group.documents.length)
          await db.collection(name).insertMany(group.documents, { session });
      }
      await db.collection('demo_runs').insertOne(
        {
          _id: runId,
          version,
          digest,
          status: 'COMPLETE',
          importedAt: new Date(),
          excludedCollections: [...excluded],
          note: 'Client demonstration only. No real transactions.',
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
}

function addFixtures(data) {
  const rows = (name) => (data[name] ??= { indexes: [], documents: [] }).documents;
  const add = (name, key, fields, date = stamp) => {
    const record = { _id: id(key), ...fields, createdAt: date, updatedAt: date, __v: 0 };
    rows(name).push(record);
    return record;
  };
  const products = rows('products');
  const machines = rows('machines');
  const customer = rows('users').find((u) => u.email === 'customer@megha.com');
  const technician = rows('users').find((u) => u.email === 'technician@megha.com');
  const admin = rows('users').find((u) => u.email === 'superadmin@megha.com');
  assert(
    customer && technician && admin && products.length,
    'Required local demo accounts/catalogue are missing.',
  );
  const customers = [customer];
  const companies = [
    'Bluebird Hotel',
    'CityCare Hospital',
    'FreshFold Laundry',
    'Campus Linen',
    'Harbour Suites',
    'Metro Uniforms',
  ];
  for (let i = 0; i < companies.length; i++)
    customers.push(
      add(
        'users',
        'customer-' + i,
        {
          name: 'DEMO ' + companies[i],
          company: 'DEMO ' + companies[i],
          email: `demo.customer${i + 1}@example.com`,
          password: customer.password,
          role: 'CUSTOMER',
          active: true,
          phone: '9000000000',
        },
        ago(i * 7 + 2),
      ),
    );

  const address = {
    line1: 'DEMO ONLY - 12 Sample Industrial Estate',
    line2: 'No dispatch permitted',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500003',
  };
  const orderStates = [
    'PAID',
    'PROCESSING',
    'PACKED',
    'SHIPPED',
    'SHIPPED',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'RETURN_REQUESTED',
    'REFUND_PENDING',
    'REFUNDED',
    'PARTIALLY_REFUNDED',
  ];
  const consumed = new Map();
  for (let i = 0; i < 36; i++) {
    const state = i < orderStates.length ? orderStates[i] : 'DELIVERED';
    const who = i < 12 ? customer : customers[i % customers.length];
    const created = ago(i < 12 ? (i === 0 ? 0.25 : i + 1) : i * 2);
    const elapsed = stamp.getTime() - created.getTime();
    const when = (ratio) => new Date(created.getTime() + elapsed * ratio);
    const items = [products[i % products.length], products[(i + 3) % products.length]].map(
      (p, j) => {
        const quantity = 1 + ((i + j) % 3),
          net = p.price * quantity;
        const tax = Math.round((net * p.gstRate) / 100);
        if (state !== 'CANCELLED')
          consumed.set(String(p._id), (consumed.get(String(p._id)) ?? 0) + quantity);
        return {
          productId: String(p._id),
          name: p.name,
          sku: p.sku,
          partNumber: p.partNumber,
          image: p.image,
          quantity,
          unitPrice: p.price,
          gstRate: p.gstRate,
          tax,
          total: net + tax,
        };
      },
    );
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const tax = items.reduce((sum, item) => sum + item.tax, 0),
      shipping = 12000;
    const paid = state !== 'CANCELLED';
    const fulfilment = ['PAID', 'CANCELLED'].includes(state)
      ? 'UNFULFILLED'
      : state === 'PROCESSING'
        ? 'PICKING'
        : state === 'PACKED'
          ? 'PACKED'
          : state === 'SHIPPED'
            ? 'SHIPPED'
            : 'DELIVERED';
    const order = add(
      'orders',
      'order-' + i,
      {
        number: 'DEMO-P1-' + serial(i),
        userId: who._id,
        idempotencyKey: version + ':order:' + i,
        items,
        subtotal,
        tax,
        shipping,
        total: subtotal + tax + shipping,
        customer: {
          name: who.name,
          email: who.email,
          phone: '9000000000',
          company: who.company || 'DEMO Laundry',
        },
        address,
        billingAddress: address,
        status: state,
        paymentStatus: !paid
          ? 'FAILED'
          : ['REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(state)
            ? state
            : 'CAPTURED',
        fulfilmentStatus: fulfilment,
        paymentProvider: 'demo',
        refundedAmount: 0,
        // No provider payment/order IDs: synthetic records cannot be mistaken for real gateway transactions.
        ...(paid
          ? { confirmedAt: when(0.05) }
          : { cancelledAt: when(0.1), cancelReason: 'DEMO: customer cancelled before payment' }),
        shippingService: {
          service: 'demo',
          label: 'DEMO courier - no real booking',
          amount: shipping,
          etaDays: 4,
        },
        history: [
          {
            status: state,
            at: when(0.95),
            actor: String(admin._id),
            description:
              'DEMO: illustrative workflow state. No payment or courier operation took place.',
          },
        ],
      },
      created,
    );
    if (!['UNFULFILLED', 'PICKING'].includes(fulfilment))
      order.package = {
        weight: 2.5,
        length: 30,
        breadth: 25,
        height: 20,
        count: 1,
        notes: 'DEMO parcel only. Do not dispatch.',
        packedAt: when(0.1),
        packedBy: String(admin._id),
      };
    if (['SHIPPED', 'DELIVERED'].includes(fulfilment)) {
      const status =
        fulfilment === 'DELIVERED'
          ? 'DELIVERED'
          : i === 3
            ? 'IN_TRANSIT'
            : i === 4
              ? 'OUT_FOR_DELIVERY'
              : 'NDR';
      const shipment = add(
        'shipments',
        'shipment-' + i,
        {
          orderId: String(order._id),
          orderNumber: order.number,
          providerReference: 'DEMO-PARCEL-' + serial(i),
          active: true,
          provider: 'demo',
          customerName: who.name,
          customerPhone: '9000000000',
          status,
          courierName: 'DEMO Logistics (illustration)',
          awb: 'DEMOAWB' + serial(i),
          labelPrinted: false,
          labelPrintCount: 0,
          pickupStatus: 'PICKED_UP',
          pickedUpAt: when(0.2),
          package: { weight: 2.5, length: 30, breadth: 25, height: 20, count: 1 },
          lastEvent: {
            status,
            activity: 'DEMO tracking event - no real parcel',
            location: 'Hyderabad demo hub',
            at: when(0.8),
          },
          syncedAt: stamp,
          ...(status === 'DELIVERED'
            ? { deliveredAt: when(0.8) }
            : { expectedDeliveryAt: ago(-3) }),
          ...(status === 'NDR'
            ? {
                ndr: {
                  reason: 'DEMO: delivery address confirmation required',
                  attempts: 1,
                  lastAttemptAt: when(0.8),
                  actions: [],
                },
              }
            : {}),
        },
        when(0.15),
      );
      order.shipment = {
        id: String(shipment._id),
        status,
        awb: shipment.awb,
        courierName: shipment.courierName,
        pickupStatus: 'PICKED_UP',
        labelStatus: 'NOT_GENERATED',
        lastUpdateAt: when(0.8),
        lastLocation: 'Hyderabad demo hub',
      };
      if (fulfilment === 'DELIVERED') order.deliveredAt = when(0.8);
      for (const [j, event] of ['PICKED_UP', 'IN_TRANSIT', status].entries())
        add(
          'shipmentevents',
          `event-${i}-${j}`,
          {
            shipmentId: String(shipment._id),
            orderId: String(order._id),
            awb: shipment.awb,
            providerStatus: event,
            normalizedStatus: event,
            activity: 'DEMO: ' + event.replaceAll('_', ' '),
            location: 'Hyderabad demo hub',
            at: when(0.2 + j * 0.3),
            source: 'demo',
            fingerprint: `${version}:${i}:${j}`,
          },
          when(0.2 + j * 0.3),
        );
    }
    if (i >= 8 && i <= 11) {
      const refunded = state === 'REFUNDED' || state === 'PARTIALLY_REFUNDED';
      const returnedItems = (state === 'REFUNDED' ? items : [items[0]]).map((x) => ({
        productId: x.productId,
        name: x.name,
        sku: x.sku,
        quantity: x.quantity,
        unitPrice: Math.round(x.total / x.quantity),
      }));
      const ret = add(
        'returns',
        'return-' + i,
        {
          number: 'DEMO-RET-' + serial(i),
          orderId: String(order._id),
          orderNumber: order.number,
          userId: String(who._id),
          items: returnedItems,
          reason: 'DEMO: wrong part selected',
          comments: 'Client presentation sample; no goods returned.',
          status: i === 8 ? 'REQUESTED' : refunded ? 'COMPLETED' : 'RECEIVED',
          decisionNotes: 'DEMO: workflow illustration',
          idempotencyKey: version + ':return:' + i,
          receivedItems:
            i === 8
              ? []
              : returnedItems.map((x) => ({
                  productId: x.productId,
                  quantity: x.quantity,
                  condition: 'DAMAGED',
                })),
          history: [
            {
              status: i === 8 ? 'REQUESTED' : refunded ? 'COMPLETED' : 'RECEIVED',
              at: when(0.9),
              actor: String(admin._id),
              description: 'DEMO return state; no stock restock',
            },
          ],
        },
        when(0.85),
      );
      if (i !== 8) {
        const amount = state === 'REFUNDED' ? order.total : items[0].total;
        const refund = add(
          'refunds',
          'refund-' + i,
          {
            orderId: String(order._id),
            orderNumber: order.number,
            returnId: String(ret._id),
            amount,
            reason: 'DEMO ONLY: example refund; no money transferred',
            status: refunded ? 'PROCESSED' : 'PENDING',
            requestedBy: String(admin._id),
            idempotencyKey: version + ':refund:' + i,
            ...(refunded ? { processedAt: when(0.95) } : {}),
          },
          when(0.9),
        );
        ret.refundId = String(refund._id);
        order.refundedAmount = refunded ? amount : 0;
      }
    }
    if (paid)
      for (const [j, item] of items.entries())
        add(
          'inventorytransactions',
          `sale-${i}-${j}`,
          {
            key: version + ':sale:' + i + ':' + j,
            productId: item.productId,
            quantity: -item.quantity,
            type: 'SALE',
            reason: 'DEMO order stock consumption',
            actorId: String(admin._id),
            orderId: String(order._id),
          },
          when(0.05),
        );
  }
  for (const [i, p] of products.entries()) {
    const used = consumed.get(String(p._id)) ?? 0;
    const finalStock = i === 10 ? 3 : i === 11 ? 0 : 30 + i * 4;
    const adjustment = finalStock + used - p.stock;
    add(
      'inventorytransactions',
      'stock-' + i,
      {
        key: version + ':stock:' + i,
        productId: String(p._id),
        quantity: adjustment,
        type: 'ADJUSTMENT',
        reason: 'DEMO opening-stock adjustment for client presentation',
        actorId: String(admin._id),
      },
      ago(90),
    );
    p.stock = finalStock;
    p.developmentOnly = false;
  }

  const stages = {
    enquiries: [
      'NEW',
      'CONTACTED',
      'QUOTE_PREPARED',
      'QUOTE_SENT',
      'NEGOTIATION',
      'ACCEPTED',
      'REJECTED',
      'EXPIRED',
      'CLOSED',
      'NEW',
      'QUOTE_SENT',
      'CONTACTED',
    ],
    'service-requests': [
      'NEW',
      'TRIAGED',
      'ASSIGNED',
      'SCHEDULED',
      'IN_PROGRESS',
      'WAITING_FOR_PARTS',
      'WAITING_FOR_CUSTOMER',
      'COMPLETED',
      'CLOSED',
      'CANCELLED',
    ],
    'find-my-spare': [
      'NEW',
      'ASSIGNED',
      'REVIEWING',
      'NEED_MORE_INFO',
      'IDENTIFIED',
      'RESOLVED',
      'CLOSED',
    ],
  };
  for (const [kind, statuses] of Object.entries(stages))
    for (const [i, status] of statuses.entries()) {
      const who = i < 6 ? customer : customers[i % customers.length];
      const p = products[i % products.length];
      const title =
        kind === 'enquiries'
          ? [
              'Hotel laundry setup quotation',
              'Bulk spare parts requirement',
              'Washer installation estimate',
              'Hospital laundry expansion',
            ][i % 4]
          : kind === 'service-requests'
            ? [
                'Washer installation',
                'Dryer heating inspection',
                'Preventive maintenance visit',
                'Washer vibration diagnosis',
              ][i % 4]
            : p.name + ' identification';
      const details = {
        company: who.company || 'DEMO Laundry',
        machine: machines[i % machines.length].name,
        location: 'Hyderabad',
        quantity: 2 + i,
        partNumber: p.partNumber,
        priority: ['NORMAL', 'HIGH', 'URGENT', 'LOW'][i % 4],
        internalNotes:
          'DEMO: fictional client presentation record. No dispatch, email, or visit requested.',
        publicResponse:
          status === 'NEW'
            ? ''
            : 'DEMO update: your request is being handled by the Megha team. This is sample data.',
      };
      if (kind === 'service-requests' && !['NEW', 'TRIAGED', 'CANCELLED'].includes(status)) {
        details.technicianId = String(technician._id);
        details.scheduledAt = ago(['COMPLETED', 'CLOSED'].includes(status) ? 2 : -2).toISOString();
      }
      if (kind === 'find-my-spare' && ['IDENTIFIED', 'RESOLVED', 'CLOSED'].includes(status))
        details.identifiedProductId = String(p._id);
      if (kind === 'enquiries' && !['NEW', 'CONTACTED', 'CLOSED'].includes(status)) {
        const net = p.price * (2 + i),
          tax = Math.round((net * p.gstRate) / 100);
        details.quoteLines = [
          {
            description: p.name + ' (DEMO quotation)',
            quantity: 2 + i,
            unitPrice: p.price,
            gstRate: p.gstRate,
          },
        ];
        details.quoteTotals = { subtotal: net, tax, total: net + tax };
        details.validUntil = ago(status === 'EXPIRED' ? 1 : -14).toISOString();
      }
      add(
        'entities',
        `${kind}-${i}`,
        {
          kind,
          number: `DEMO-${kind.slice(0, 3).toUpperCase()}-${serial(i)}`,
          ownerId: who._id,
          title: 'DEMO - ' + title,
          name: who.name,
          email: who.email,
          phone: '9000000000',
          description:
            'Client demonstration: ' + title + '. Fictional requirement, for presentation only.',
          status,
          data: details,
          history: [
            { status: 'NEW', at: ago(i + 2) },
            ...(status === 'NEW' ? [] : [{ status, at: ago(0.25) }]),
          ],
        },
        ago(i + 2),
      );
    }
  for (const [i, machine] of machines.entries()) {
    const model = add('entities', 'model-' + i, {
      kind: 'machine-models',
      title: 'DEMO ' + machine.name + ' Model',
      status: 'ACTIVE',
      description:
        'Illustrative model for client presentation. Not a verified technical specification.',
      data: {
        machineId: String(machine._id),
        manufacturer: 'Megha (demo)',
        modelNumber: 'DEMO-MODEL-' + serial(i),
      },
    });
    add('compatibilities', 'compatibility-' + i, {
      machineModelId: String(model._id),
      productId: String(products[i]._id),
      verified: false,
      notes: 'DEMO association only. Technical verification required before supplying any part.',
    });
  }
  for (const [i, label] of ['Laundry unit', 'Warehouse'].entries())
    add('entities', 'address-' + i, {
      kind: 'addresses',
      ownerId: customer._id,
      title: 'DEMO ' + label,
      status: 'ACTIVE',
      description: 'DEMO ONLY - 12 Sample Industrial Estate, Hyderabad, Telangana 500003',
      data: {},
    });
  for (let i = 0; i < 3; i++)
    add('entities', 'saved-' + i, {
      kind: 'saved',
      ownerId: customer._id,
      title: products[i].name,
      status: 'ACTIVE',
      data: { productId: String(products[i]._id) },
    });
  for (let i = 0; i < 6; i++)
    add(
      'entities',
      'notification-' + i,
      {
        kind: 'notifications',
        ownerId: customer._id,
        number: 'DEMO-NOTICE-' + serial(i),
        title:
          'DEMO - ' + ['Order is processing', 'Quotation ready', 'Service visit scheduled'][i % 3],
        description:
          'Sample account notification for the client walkthrough. No external message was sent.',
        status: 'UNREAD',
        data: i % 3 === 0 ? { orderId: String(id('order-1')) } : {},
      },
      ago(i / 3),
    );
  if (!rows('carts').some((c) => String(c.userId) === String(customer._id)))
    add('carts', 'cart', {
      userId: customer._id,
      items: products.slice(0, 3).map((p, i) => ({ productId: String(p._id), quantity: i + 1 })),
    });
  add('entities', 'announcement', {
    kind: 'settings',
    title: 'Client demo announcement',
    status: 'ACTIVE',
    description: 'Labels this deployment as a demonstration.',
    data: {
      key: 'announcement',
      value: 'Client demonstration | Sample data | No live payments or dispatch',
    },
  });
  for (const [i, title] of [
    'Choosing spare parts for your laundry',
    'Preparing for a service visit',
    'How to request a machine quotation',
  ].entries())
    add('entities', 'content-' + i, {
      kind: 'content',
      title: 'DEMO - ' + title,
      status: 'PUBLISHED',
      description:
        'Demonstration content. Share the machine model, capacity and part number with the team. Technical suitability and commercial terms must be confirmed before purchasing.',
      data: { slug: 'demo-guide-' + (i + 1), section: 'resource' },
    });
  add('audits', 'audit', {
    actorId: String(admin._id),
    action: 'DEMO_DATA_PREPARED',
    entity: 'client-demo',
    entityId: version,
    summary:
      'Existing local business data copied; labelled fictional workflows added. No external operations.',
  });
  return data;
}

async function verify(db, expected) {
  const counts = {};
  for (const [name, group] of Object.entries(expected)) {
    if (excluded.has(name)) continue;
    const documents = await db
      .collection(name)
      .find({ _id: { $in: group.documents.map((d) => d._id) } })
      .toArray();
    assert.equal(documents.length, group.documents.length, 'Missing records in ' + name);
    counts[name] = documents.length;
  }
  const users = await db.collection('users').find({}).toArray();
  const products = await db.collection('products').find({}).toArray();
  for (const role of [
    'SUPER_ADMIN',
    'ADMIN',
    'SALES',
    'INVENTORY_MANAGER',
    'SERVICE_MANAGER',
    'TECHNICIAN',
    'CUSTOMER',
  ])
    assert(
      users.some((u) => u.role === role && u.active),
      'Missing active role: ' + role,
    );
  assert(products.every((p) => p.stock >= 0 && p.reserved >= 0 && p.stock >= p.reserved));
  assert.equal(
    await db
      .collection('products')
      .countDocuments({ active: true, developmentOnly: { $ne: true } }),
    12,
  );
  for (const order of await db
    .collection('orders')
    .find({ number: /^DEMO-/ })
    .toArray()) {
    assert(users.some((u) => String(u._id) === String(order.userId)));
    assert.equal(order.total, order.subtotal + order.tax + order.shipping);
    assert.equal(
      order.tax,
      order.items.reduce((sum, item) => sum + item.tax, 0),
    );
    assert.equal(
      order.subtotal,
      order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    );
    for (const item of order.items) assert(products.some((p) => String(p._id) === item.productId));
    assert(
      !order.providerOrderId && !order.providerPaymentId,
      'Synthetic orders must not have gateway identifiers.',
    );
    if (order.shipment)
      assert(
        await db
          .collection('shipments')
          .findOne({ _id: new ObjectId(order.shipment.id), orderId: String(order._id) }),
      );
    const refunds = await db
      .collection('refunds')
      .find({ orderId: String(order._id), status: 'PROCESSED' })
      .toArray();
    assert.equal(
      order.refundedAmount,
      refunds.reduce((sum, refund) => sum + refund.amount, 0),
    );
  }
  console.log('Verified', db.databaseName, JSON.stringify(counts));
  return counts;
}

await fs.mkdir(work, { recursive: true });
const mode = process.argv[2] || 'prepare';
const clients = [];
async function open(uri) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  clients.push(client);
  await client.connect();
  return client.db();
}
try {
  if (mode === 'prepare') {
    assert(
      /127\.0\.0\.1|localhost/.test(sourceEnv.MONGODB_URI),
      'Preparation requires the original local source.',
    );
    let data;
    try {
      data = BSON.EJSON.parse(await fs.readFile(stagedFile, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const source = await open(sourceEnv.MONGODB_URI);
      const original = await snapshot(source);
      await fs.writeFile(snapshotFile, BSON.EJSON.stringify(original, { relaxed: false }), {
        flag: 'wx',
      });
      data = addFixtures(BSON.EJSON.parse(BSON.EJSON.stringify(original, { relaxed: false })));
      for (const name of excluded) delete data[name];
      await fs.writeFile(stagedFile, BSON.EJSON.stringify(data, { relaxed: false }), {
        flag: 'wx',
      });
    }
    const digest = createHash('sha256')
      .update(await fs.readFile(stagedFile))
      .digest('hex');
    const db = await open(stageUri);
    await restoreEmpty(db, data, digest);
    const counts = await verify(db, data);
    await fs.writeFile(
      path.join(work, 'preparation-report.json'),
      JSON.stringify(
        {
          version,
          database: db.databaseName,
          preparedAt: stamp,
          counts,
          digest,
          exclusions: [...excluded],
        },
        null,
        2,
      ),
    );
  } else if (mode === 'publish') {
    const uri = privateEnv.TARGET_MONGODB_URI;
    assert(uri?.startsWith('mongodb+srv://'), 'An Atlas target URI is required.');
    assert.equal(
      new URL(uri).pathname,
      '/megha_client_demo',
      'Only the dedicated megha_client_demo database may be populated.',
    );
    const data = BSON.EJSON.parse(await fs.readFile(stagedFile, 'utf8'));
    const digest = createHash('sha256')
      .update(await fs.readFile(stagedFile))
      .digest('hex');
    const target = await open(uri);
    await restoreEmpty(target, data, digest);
    const counts = await verify(target, data);
    await fs.writeFile(
      path.join(work, 'atlas-import-report.json'),
      JSON.stringify(
        { version, database: target.databaseName, importedAt: stamp, counts, digest },
        null,
        2,
      ),
    );
    // Change the local app only after a successful Atlas import and verification.
    await fs
      .copyFile(
        'apps/api/.env',
        path.join(work, 'api-env-before-atlas.env'),
        fs.constants.COPYFILE_EXCL,
      )
      .catch((error) => {
        if (error.code !== 'EEXIST') throw error;
      });
    let contents = await fs.readFile('apps/api/.env', 'utf8');
    for (const [key, value] of Object.entries({
      MONGODB_URI: uri,
      PAYMENT_PROVIDER: 'disabled',
      SHIPPING_PROVIDER: 'disabled',
      EMAIL_PROVIDER: 'disabled',
      ENABLE_CHECKOUT: 'false',
    })) {
      const line = new RegExp('^' + key + '=.*$', 'm');
      contents = line.test(contents)
        ? contents.replace(line, () => key + '=' + value)
        : contents + '\n' + key + '=' + value + '\n';
    }
    await fs.writeFile('apps/api/.env', contents);
    console.log(
      'Atlas import verified. Local API now points to Atlas with external integrations disabled.',
    );
  } else throw new Error('Choose prepare or publish.');
} catch (error) {
  console.error(error.name + ': ' + safeError(error));
  process.exitCode = 1;
} finally {
  await Promise.all(clients.map((c) => c.close()));
}
