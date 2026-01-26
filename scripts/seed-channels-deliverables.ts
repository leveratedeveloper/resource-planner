import { db } from '../lib/db';
import { channelClassifications, deliverables } from '../lib/db/schema';

// Channel Classifications data (30 entries from MySQL)
const channelsData = [
  { id: '1', channelName: 'Creative', displayOrder: 1 },
  { id: '2', channelName: 'Digital Creative', displayOrder: 2 },
  { id: '3', channelName: 'Strategy & Planning', displayOrder: 3 },
  { id: '4', channelName: 'KOL', displayOrder: 4 },
  { id: '5', channelName: 'Paid Social', displayOrder: 5 },
  { id: '6', channelName: 'SEO', displayOrder: 6 },
  { id: '7', channelName: 'SMM', displayOrder: 7 },
  { id: '8', channelName: 'Website Dev', displayOrder: 8 },
  { id: '9', channelName: 'Direct Placement', displayOrder: 9 },
  { id: '10', channelName: 'Offline', displayOrder: 10 },
  { id: '11', channelName: 'PR', displayOrder: 11 },
  { id: '12', channelName: 'Event', displayOrder: 12 },
  { id: '13', channelName: 'Content Production', displayOrder: 13 },
  { id: '14', channelName: 'Media Planning & Buying', displayOrder: 14 },
  { id: '15', channelName: 'E-commerce', displayOrder: 15 },
  { id: '16', channelName: 'Analytics', displayOrder: 16 },
  { id: '17', channelName: 'CRM', displayOrder: 17 },
  { id: '18', channelName: 'Email Marketing', displayOrder: 18 },
  { id: '19', channelName: 'Performance Marketing', displayOrder: 19 },
  { id: '20', channelName: 'Community Management', displayOrder: 20 },
  { id: '21', channelName: 'Video Production', displayOrder: 21 },
  { id: '22', channelName: 'Photography', displayOrder: 22 },
  { id: '23', channelName: 'Influencer Marketing', displayOrder: 23 },
  { id: '24', channelName: 'Branding', displayOrder: 24 },
  { id: '25', channelName: 'Copywriting', displayOrder: 25 },
  { id: '26', channelName: 'Design', displayOrder: 26 },
  { id: '27', channelName: 'Digital PR', displayOrder: 27 },
  { id: '28', channelName: 'Market Research', displayOrder: 28 },
  { id: '29', channelName: 'Consultation', displayOrder: 29 },
  { id: '30', channelName: 'Other', displayOrder: 30 },
];

// Deliverables data (organized by channel)
const deliverablesData = [
  // Creative (channel 1)
  { channelId: '1', deliverableName: 'Creative Concept Development' },
  { channelId: '1', deliverableName: 'Art Direction' },
  { channelId: '1', deliverableName: 'Campaign Creative' },

  // Digital Creative (channel 2)
  { channelId: '2', deliverableName: 'Social Media Creative' },
  { channelId: '2', deliverableName: 'Digital Banner Ads' },
  { channelId: '2', deliverableName: 'Landing Page Design' },

  // Strategy & Planning (channel 3)
  { channelId: '3', deliverableName: 'Media Planning' },
  { channelId: '3', deliverableName: 'Campaign Strategy' },
  { channelId: '3', deliverableName: 'Marketing Strategy' },
  { channelId: '3', deliverableName: 'Digital Strategy' },

  // KOL (channel 4)
  { channelId: '4', deliverableName: 'KOL Management' },
  { channelId: '4', deliverableName: 'KOL Selection & Outreach' },
  { channelId: '4', deliverableName: 'KOL Content Creation' },

  // Paid Social (channel 5)
  { channelId: '5', deliverableName: 'Meta [FBIG] Ads' },
  { channelId: '5', deliverableName: 'TikTok Ads' },
  { channelId: '5', deliverableName: 'YouTube Ads' },
  { channelId: '5', deliverableName: 'Twitter/X Ads' },
  { channelId: '5', deliverableName: 'LinkedIn Ads' },

  // SEO (channel 6)
  { channelId: '6', deliverableName: 'SEO Audit' },
  { channelId: '6', deliverableName: 'On-Page SEO' },
  { channelId: '6', deliverableName: 'Off-Page SEO' },
  { channelId: '6', deliverableName: 'Technical SEO' },

  // SMM (channel 7)
  { channelId: '7', deliverableName: 'Social Media Management' },
  { channelId: '7', deliverableName: 'Content Calendar' },
  { channelId: '7', deliverableName: 'Post Scheduling' },

  // Website Dev (channel 8)
  { channelId: '8', deliverableName: 'Website Development' },
  { channelId: '8', deliverableName: 'Website Maintenance' },
  { channelId: '8', deliverableName: 'Landing Page Development' },

  // Direct Placement (channel 9)
  { channelId: '9', deliverableName: 'Media Buying' },
  { channelId: '9', deliverableName: 'Ad Placement' },

  // Offline (channel 10)
  { channelId: '10', deliverableName: 'Print Ads' },
  { channelId: '10', deliverableName: 'TV Commercial' },
  { channelId: '10', deliverableName: 'Radio Spot' },
  { channelId: '10', deliverableName: 'OOH (Outdoor)' },

  // PR (channel 11)
  { channelId: '11', deliverableName: 'Press Release' },
  { channelId: '11', deliverableName: 'Media Relations' },
  { channelId: '11', deliverableName: 'Crisis Management' },

  // Event (channel 12)
  { channelId: '12', deliverableName: 'Event Planning' },
  { channelId: '12', deliverableName: 'Event Execution' },
  { channelId: '12', deliverableName: 'Virtual Event' },

  // Content Production (channel 13)
  { channelId: '13', deliverableName: 'Content Creation' },
  { channelId: '13', deliverableName: 'Blog Writing' },
  { channelId: '13', deliverableName: 'Article Writing' },

  // Media Planning & Buying (channel 14)
  { channelId: '14', deliverableName: 'Media Planning' },
  { channelId: '14', deliverableName: 'Media Buying' },
  { channelId: '14', deliverableName: 'Media Monitoring' },

  // E-commerce (channel 15)
  { channelId: '15', deliverableName: 'E-commerce Management' },
  { channelId: '15', deliverableName: 'Marketplace Optimization' },

  // Analytics (channel 16)
  { channelId: '16', deliverableName: 'Analytics Setup' },
  { channelId: '16', deliverableName: 'Reporting & Analysis' },
  { channelId: '16', deliverableName: 'Data Visualization' },

  // CRM (channel 17)
  { channelId: '17', deliverableName: 'CRM Setup' },
  { channelId: '17', deliverableName: 'CRM Management' },

  // Email Marketing (channel 18)
  { channelId: '18', deliverableName: 'Email Campaign' },
  { channelId: '18', deliverableName: 'Newsletter Design' },

  // Performance Marketing (channel 19)
  { channelId: '19', deliverableName: 'Performance Campaign' },
  { channelId: '19', deliverableName: 'Conversion Optimization' },

  // Community Management (channel 20)
  { channelId: '20', deliverableName: 'Community Engagement' },
  { channelId: '20', deliverableName: 'Community Moderation' },

  // Video Production (channel 21)
  { channelId: '21', deliverableName: 'Video Production' },
  { channelId: '21', deliverableName: 'Video Editing' },

  // Photography (channel 22)
  { channelId: '22', deliverableName: 'Product Photography' },
  { channelId: '22', deliverableName: 'Event Photography' },
];

async function seedChannelsAndDeliverables() {
  console.log('Starting seed for channels and deliverables...');

  try {
    // Insert channels
    console.log('Inserting channel classifications...');
    const channelMap = new Map<string, string>();

    for (const channel of channelsData) {
      const [insertedChannel] = await db
        .insert(channelClassifications)
        .values({
          channelName: channel.channelName,
          displayOrder: channel.displayOrder,
          flag: 'active',
        })
        .returning();

      channelMap.set(channel.id, insertedChannel.id);
      console.log(`  ✓ Inserted: ${channel.channelName}`);
    }

    // Insert deliverables
    console.log('\nInserting deliverables...');
    for (const deliverable of deliverablesData) {
      const channelUuid = channelMap.get(deliverable.channelId);
      if (!channelUuid) {
        console.warn(`  ⚠ Channel ID ${deliverable.channelId} not found for deliverable: ${deliverable.deliverableName}`);
        continue;
      }

      await db
        .insert(deliverables)
        .values({
          channelId: channelUuid,
          deliverableName: deliverable.deliverableName,
          flag: 'active',
        });

      console.log(`  ✓ Inserted: ${deliverable.deliverableName} (Channel: ${deliverable.channelId})`);
    }

    console.log('\n✅ Seeding completed successfully!');
    console.log(`   - ${channelsData.length} channels inserted`);
    console.log(`   - ${deliverablesData.length} deliverables inserted`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Run seeding
seedChannelsAndDeliverables()
  .then(() => {
    console.log('Seed script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed script failed:', error);
    process.exit(1);
  });
