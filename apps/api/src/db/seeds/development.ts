import '../../load-env';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';
import { SYSTEM_TEMPLATES } from './templates';

// Deterministic IDs for easy cross-reference in tests
const IDS = {
  workspace: '10000000-0000-0000-0000-000000000001',
  alex: '20000000-0000-0000-0000-000000000001',
  jordan: '20000000-0000-0000-0000-000000000002',
  // Projects
  occasionProject: '30000000-0000-0000-0000-000000000001',
  complianceProject: '30000000-0000-0000-0000-000000000002',
  householdProject: '30000000-0000-0000-0000-000000000003',
  healthProject: '30000000-0000-0000-0000-000000000004',
  travelProject: '30000000-0000-0000-0000-000000000005',
  planningProject: '30000000-0000-0000-0000-000000000006',
  // People
  personSusan: '40000000-0000-0000-0000-000000000001',
  personDavid: '40000000-0000-0000-0000-000000000002',
  personDoctor: '40000000-0000-0000-0000-000000000003',
};

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0]!;
}

async function seed() {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  console.log('🌱 Seeding database...');

  // ── System templates ──────────────────────────────────────────
  console.log('  → Inserting system templates...');
  for (const template of SYSTEM_TEMPLATES) {
    await db
      .insert(schema.projectTemplates)
      .values(template)
      .onConflictDoNothing();
  }

  // ── Workspace ─────────────────────────────────────────────────
  console.log('  → Creating workspace...');
  await db
    .insert(schema.workspaces)
    .values({ id: IDS.workspace, name: 'Our Home' })
    .onConflictDoNothing();

  // ── Users ─────────────────────────────────────────────────────
  console.log('  → Creating users (Alex & Jordan)...');
  await db
    .insert(schema.users)
    .values([
      {
        id: IDS.alex,
        clerkId: 'seed_clerk_alex',
        email: 'alex@lifesync.dev',
        displayName: 'Alex',
        timezone: 'Europe/London',
        notificationPreferences: { digestMode: 'daily', channels: { push: true, email: true, inApp: true } },
      },
      {
        id: IDS.jordan,
        clerkId: 'seed_clerk_jordan',
        email: 'jordan@lifesync.dev',
        displayName: 'Jordan',
        timezone: 'Europe/London',
        notificationPreferences: { digestMode: 'weekly', channels: { push: true, email: false, inApp: true } },
      },
    ])
    .onConflictDoNothing();

  // ── Workspace members ─────────────────────────────────────────
  await db
    .insert(schema.workspaceMembers)
    .values([
      { workspaceId: IDS.workspace, userId: IDS.alex, role: 'owner', joinedAt: new Date() },
      { workspaceId: IDS.workspace, userId: IDS.jordan, role: 'member', joinedAt: new Date() },
    ])
    .onConflictDoNothing();

  // ── Projects ──────────────────────────────────────────────────
  console.log('  → Creating sample projects...');
  await db
    .insert(schema.projects)
    .values([
      {
        id: IDS.occasionProject,
        workspaceId: IDS.workspace,
        type: 'occasion',
        title: "Mum's 60th Birthday",
        description: 'Big milestone — needs to be special',
        status: 'active',
        priority: 'high',
        ownerId: IDS.alex,
        visibility: 'shared',
        dueDate: daysFromNow(45),
        earliestActionDate: daysFromNow(7),
        leadTimeDays: 30,
        customFields: {
          event_date: daysFromNow(45),
          gift_budget: 200,
          guests: ['Family', 'Close friends'],
          recurring_annually: true,
        },
      },
      {
        id: IDS.complianceProject,
        workspaceId: IDS.workspace,
        type: 'compliance',
        title: 'Resident Permit Renewal',
        description: 'Annual renewal — needs documents from employer',
        status: 'active',
        priority: 'urgent',
        ownerId: IDS.jordan,
        visibility: 'shared',
        dueDate: daysFromNow(60),
        earliestActionDate: daysFromNow(0),
        leadTimeDays: 90,
        customFields: {
          document_type: 'resident_permit',
          issuing_authority: 'Immigration Office',
          reference_number: '',
          documents_required: ['Employment letter', 'Bank statements', 'Rental contract', 'Photos'],
        },
      },
      {
        id: IDS.householdProject,
        workspaceId: IDS.workspace,
        type: 'household',
        title: 'Weekly Groceries',
        description: 'Regular grocery run',
        status: 'active',
        priority: 'medium',
        ownerId: null,
        visibility: 'shared',
        dueDate: daysFromNow(3),
        isRecurring: true,
        recurrenceRule: { frequency: 'weekly', day: 'saturday' },
        customFields: { area: 'kitchen', frequency: 'weekly' },
      },
      {
        id: IDS.healthProject,
        workspaceId: IDS.workspace,
        type: 'health',
        title: 'Annual Health Checkup — Alex',
        description: "Alex's yearly GP visit",
        status: 'active',
        priority: 'medium',
        ownerId: IDS.alex,
        visibility: 'private',
        dueDate: daysFromNow(30),
        leadTimeDays: 14,
        customFields: {
          provider: 'Dr. Sarah Smith',
          appointment_type: 'annual_checkup',
        },
      },
      {
        id: IDS.travelProject,
        workspaceId: IDS.workspace,
        type: 'travel',
        title: 'Summer Holiday — Barcelona',
        description: 'One week in Barcelona in August',
        status: 'active',
        priority: 'medium',
        ownerId: IDS.alex,
        visibility: 'shared',
        dueDate: daysFromNow(90),
        earliestActionDate: daysFromNow(14),
        leadTimeDays: 60,
        customFields: {
          destination: 'Barcelona, Spain',
          departure_date: daysFromNow(90),
          return_date: daysFromNow(97),
          visa_required: false,
          booking_refs: {},
        },
      },
      {
        id: IDS.planningProject,
        workspaceId: IDS.workspace,
        type: 'planning',
        title: 'Move to New Apartment',
        description: 'Moving to a larger flat in the new year',
        status: 'active',
        priority: 'medium',
        ownerId: null,
        visibility: 'shared',
        dueDate: daysFromNow(180),
        earliestActionDate: daysFromNow(30),
        customFields: {
          budget: 5000,
          decision_deadline: daysFromNow(45),
          options_considered: ['Removals company', 'DIY with van hire'],
        },
      },
    ])
    .onConflictDoNothing();

  // ── Tasks ─────────────────────────────────────────────────────
  console.log('  → Creating tasks...');
  await db
    .insert(schema.tasks)
    .values([
      // Occasion tasks
      { projectId: IDS.occasionProject, title: 'Choose venue', status: 'completed', sortOrder: 0, ownerId: IDS.alex, path: '' },
      { projectId: IDS.occasionProject, title: 'Send invitations', status: 'in_progress', sortOrder: 1, ownerId: IDS.alex, path: '' },
      { projectId: IDS.occasionProject, title: 'Order birthday cake', status: 'pending', sortOrder: 2, ownerId: IDS.jordan, path: '' },
      { projectId: IDS.occasionProject, title: 'Buy gift', status: 'pending', sortOrder: 3, ownerId: IDS.alex, path: '', dueDate: daysFromNow(35) },
      { projectId: IDS.occasionProject, title: 'Arrange decorations', status: 'pending', sortOrder: 4, ownerId: IDS.jordan, path: '' },
      // Compliance tasks
      { projectId: IDS.complianceProject, title: 'Get employment letter from HR', status: 'pending', sortOrder: 0, ownerId: IDS.jordan, path: '', dueDate: daysFromNow(7) },
      { projectId: IDS.complianceProject, title: 'Collect last 3 months bank statements', status: 'pending', sortOrder: 1, ownerId: IDS.jordan, path: '' },
      { projectId: IDS.complianceProject, title: 'Fill out application form online', status: 'pending', sortOrder: 2, ownerId: IDS.jordan, path: '' },
      { projectId: IDS.complianceProject, title: 'Book appointment at immigration office', status: 'pending', sortOrder: 3, ownerId: IDS.jordan, path: '' },
      { projectId: IDS.complianceProject, title: 'Attend appointment and submit documents', status: 'pending', sortOrder: 4, ownerId: IDS.jordan, path: '', dueDate: daysFromNow(55) },
      // Grocery tasks
      { projectId: IDS.householdProject, title: 'Fruits & vegetables', status: 'pending', sortOrder: 0, path: '' },
      { projectId: IDS.householdProject, title: 'Dairy (milk, yoghurt, cheese)', status: 'pending', sortOrder: 1, path: '' },
      { projectId: IDS.householdProject, title: 'Bread and bakery', status: 'pending', sortOrder: 2, path: '' },
      { projectId: IDS.householdProject, title: 'Cleaning supplies', status: 'pending', sortOrder: 3, path: '' },
      // Health tasks
      { projectId: IDS.healthProject, title: 'Book appointment with GP', status: 'pending', sortOrder: 0, ownerId: IDS.alex, path: '' },
      { projectId: IDS.healthProject, title: 'Prepare list of questions', status: 'pending', sortOrder: 1, ownerId: IDS.alex, path: '' },
      { projectId: IDS.healthProject, title: 'Attend appointment', status: 'pending', sortOrder: 2, ownerId: IDS.alex, path: '', dueDate: daysFromNow(30) },
      // Travel tasks
      { projectId: IDS.travelProject, title: 'Book return flights', status: 'pending', sortOrder: 0, ownerId: IDS.alex, path: '', dueDate: daysFromNow(21) },
      { projectId: IDS.travelProject, title: 'Book hotel or apartment', status: 'pending', sortOrder: 1, ownerId: IDS.jordan, path: '', dueDate: daysFromNow(21) },
      { projectId: IDS.travelProject, title: 'Arrange travel insurance', status: 'pending', sortOrder: 2, ownerId: IDS.alex, path: '' },
      { projectId: IDS.travelProject, title: 'Plan daily itinerary', status: 'pending', sortOrder: 3, ownerId: IDS.jordan, path: '' },
      // Planning tasks
      { projectId: IDS.planningProject, title: 'Research and shortlist removal companies', status: 'pending', sortOrder: 0, ownerId: IDS.jordan, path: '' },
      { projectId: IDS.planningProject, title: 'Get quotes from at least 3 companies', status: 'pending', sortOrder: 1, ownerId: IDS.jordan, path: '' },
      { projectId: IDS.planningProject, title: 'Notify current landlord', status: 'pending', sortOrder: 2, ownerId: IDS.alex, path: '', dueDate: daysFromNow(90) },
      { projectId: IDS.planningProject, title: 'Transfer utilities to new address', status: 'pending', sortOrder: 3, ownerId: IDS.alex, path: '' },
      { projectId: IDS.planningProject, title: 'Update bank and government records', status: 'pending', sortOrder: 4, ownerId: IDS.jordan, path: '' },
    ])
    .onConflictDoNothing();

  // ── Household items ───────────────────────────────────────────
  console.log('  → Creating household items...');
  await db
    .insert(schema.householdItems)
    .values([
      { workspaceId: IDS.workspace, name: 'Milk', category: 'dairy', status: 'low', unit: 'litres', quantity: 1, autoReplenish: true, addedBy: IDS.jordan, sortOrder: 0 },
      { workspaceId: IDS.workspace, name: 'Bread', category: 'bakery', status: 'out', autoReplenish: true, addedBy: IDS.alex, sortOrder: 1 },
      { workspaceId: IDS.workspace, name: 'Coffee beans', category: 'beverages', status: 'stocked', unit: 'g', quantity: 500, addedBy: IDS.alex, sortOrder: 2 },
      { workspaceId: IDS.workspace, name: 'Dishwasher tablets', category: 'cleaning', status: 'stocked', unit: 'pack', quantity: 1, autoReplenish: false, addedBy: IDS.jordan, sortOrder: 3 },
      { workspaceId: IDS.workspace, name: 'Paper towels', category: 'cleaning', status: 'low', unit: 'roll', quantity: 1, autoReplenish: true, addedBy: IDS.jordan, sortOrder: 4 },
      { workspaceId: IDS.workspace, name: 'Olive oil', category: 'pantry', status: 'on_list', addedBy: IDS.alex, sortOrder: 5 },
      { workspaceId: IDS.workspace, name: 'Eggs', category: 'dairy', status: 'low', unit: 'count', quantity: 3, autoReplenish: true, addedBy: IDS.jordan, sortOrder: 6 },
    ])
    .onConflictDoNothing();

  // ── People ────────────────────────────────────────────────────
  console.log('  → Creating people...');
  await db
    .insert(schema.people)
    .values([
      {
        id: IDS.personSusan,
        workspaceId: IDS.workspace,
        name: 'Susan (Mum)',
        relationship: 'parent',
        birthday: daysFromNow(45).replace(/\d{4}/, new Date().getFullYear().toString()),
        email: 'susan@example.com',
        giftIdeas: [
          { idea: 'Spa day voucher', budget: 80, purchased: false },
          { idea: 'Recipe book', budget: 30, purchased: false },
        ],
        notes: 'Loves gardening and cooking. Allergic to nuts.',
      },
      {
        id: IDS.personDavid,
        workspaceId: IDS.workspace,
        name: 'David (Dad)',
        relationship: 'parent',
        birthday: daysFromNow(95).replace(/\d{4}/, new Date().getFullYear().toString()),
        email: 'david@example.com',
        giftIdeas: [
          { idea: 'Golf accessories', budget: 60, purchased: false },
        ],
      },
      {
        id: IDS.personDoctor,
        workspaceId: IDS.workspace,
        name: 'Dr. Sarah Smith',
        relationship: 'doctor',
        phone: '+44 20 1234 5678',
        notes: 'GP. Surgery opens Mon-Fri 8am-6pm.',
      },
    ])
    .onConflictDoNothing();

  // ── Reminders ─────────────────────────────────────────────────
  console.log('  → Creating reminders...');
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  await db
    .insert(schema.reminders)
    .values([
      {
        projectId: IDS.complianceProject,
        userId: IDS.jordan,
        remindAt: tomorrow,
        type: 'lead_time',
        severity: 'warning',
        message: 'Permit renewal: gather documents this week — deadline in 60 days',
      },
      {
        projectId: IDS.complianceProject,
        userId: IDS.jordan,
        remindAt: in30Days,
        type: 'escalation',
        severity: 'urgent',
        message: 'Permit renewal due in 30 days — have you booked your appointment?',
      },
      {
        projectId: IDS.occasionProject,
        userId: IDS.alex,
        remindAt: in7Days,
        type: 'lead_time',
        severity: 'info',
        message: "Mum's birthday in 45 days — send invitations this week",
      },
    ])
    .onConflictDoNothing();

  // ── Activity events ───────────────────────────────────────────
  console.log('  → Creating activity events...');
  await db
    .insert(schema.activityEvents)
    .values([
      { workspaceId: IDS.workspace, userId: IDS.alex, entityType: 'project', entityId: IDS.occasionProject, action: 'created' },
      { workspaceId: IDS.workspace, userId: IDS.jordan, entityType: 'project', entityId: IDS.complianceProject, action: 'created' },
      { workspaceId: IDS.workspace, userId: IDS.alex, entityType: 'workspace', entityId: IDS.workspace, action: 'created' },
    ])
    .onConflictDoNothing();

  // ── Inbox (quick capture) ─────────────────────────────────────
  console.log('  → Creating inbox items...');
  await db
    .insert(schema.inboxItems)
    .values([
      {
        workspaceId: IDS.workspace,
        content: 'Look into a weekend cabin for the autumn',
        capturedBy: IDS.alex,
        ownerId: IDS.alex,
        visibility: 'shared',
      },
      {
        workspaceId: IDS.workspace,
        content: 'Call the dentist to reschedule',
        capturedBy: IDS.jordan,
        ownerId: IDS.jordan,
        visibility: 'shared',
      },
      {
        workspaceId: IDS.workspace,
        content: 'Anniversary gift idea — pottery class',
        capturedBy: IDS.jordan,
        ownerId: IDS.jordan,
        visibility: 'private',
      },
    ])
    .onConflictDoNothing();

  console.log('✅ Seed complete.');
  await client.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
