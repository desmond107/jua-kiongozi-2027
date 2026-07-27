/**
 * Seeds the seven declared / prospective 2027 presidential candidates.
 *
 * EDITORIAL RULE — read before changing anything in this file:
 * Every bio here is limited to neutral, publicly documented facts: offices held,
 * dates, and professional background. No quotes are attributed to any candidate.
 * No opinion, prediction, endorsement or criticism appears in any entry. Each
 * bio follows the same three-part structure and comparable length so that no
 * candidate reads as more (or less) prominently profiled than another.
 *
 * Where a party affiliation for the 2027 cycle is not formally and publicly
 * settled, `party` is left null and the UI renders "Not publicly declared"
 * rather than this file guessing. Every entry currently carries a declared
 * party, so that fallback is unexercised — keep it working anyway, since
 * affiliations shift across a cycle.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type CandidateSeed = {
  slug: string
  fullName: string
  party: string | null
  role: string
  bio: string
  orderIndex: number
  // Path under `/public/candidates/`. Null is the expected state — the UI
  // renders a designed monogram rather than treating it as a missing asset.
  photoUrl?: string | null
}

const CANDIDATES: CandidateSeed[] = [
  {
    slug: 'jimi-wanjigi',
    fullName: 'Jimi Richard Wanjigi',
    party: 'Safina Party',
    role: 'Businessman and party leader',
    orderIndex: 1,
    photoUrl: '/candidates/jimi-wanjigi.jpg',
    bio: "Jimi Richard Wanjigi is a Kenyan businessman who leads the Kwacha Group of Companies, with holdings in agriculture, real estate and finance, and co-founded the waste management firm BINS Limited. He studied business at York University and graduated from Daystar University. He sought the Orange Democratic Movement's presidential nomination ahead of the 2022 general election before leaving to lead the Safina Party, and has not held elective public office.",
  },
  {
    slug: 'martha-karua',
    fullName: 'Martha Wangari Karua',
    party: "People's Liberation Party",
    role: 'Advocate and former Cabinet Minister',
    orderIndex: 2,
    photoUrl: '/candidates/martha-karua.jpg',
    bio: 'Martha Wangari Karua is an advocate of the High Court of Kenya, admitted to the bar in 1981 after reading law at the University of Nairobi and the Kenya School of Law, and later took an MBA at USIU-Africa. She served as Member of Parliament for Gichugu from 1992 to 2013 and as Minister for Justice and Constitutional Affairs from 2005 to 2009. She was an Azimio la Umoja running mate in 2022.',
  },
  {
    slug: 'kalonzo-musyoka',
    fullName: 'Kalonzo Musyoka',
    party: 'Wiper Democratic Movement',
    role: 'Former Vice-President of Kenya',
    orderIndex: 3,
    photoUrl: '/candidates/kalonzo-musyoka.jpg',
    bio: 'Kalonzo Musyoka read law at the University of Nairobi and the Kenya School of Law, completing his studies in 1978. He was Member of Parliament for Mwingi North from 1983 to 2007, Minister for Foreign Affairs from 1993 to 1998 and Minister of Education from 2003 to 2005. He served as Vice-President of Kenya from 2008 to 2013, and founded and leads the Wiper Democratic Movement.',
  },
  {
    slug: 'william-ruto',
    fullName: 'William Ruto',
    party: 'United Democratic Alliance',
    role: 'President of the Republic of Kenya',
    orderIndex: 4,
    photoUrl: '/candidates/william-ruto.jpg',
    bio: 'William Ruto is the fifth President of the Republic of Kenya, having taken office in September 2022. He was Member of Parliament for Eldoret North from 1997 to 2013, Minister for Agriculture from 2008 to 2010 and for Higher Education from 2010 to 2012, and Deputy President from 2013 to 2022. He holds bachelor’s, master’s and doctoral degrees from the University of Nairobi, the last in plant ecology.',
  },
  {
    slug: 'fred-matiangi',
    fullName: "Fred Matiang'i",
    party: 'Jubilee Party',
    role: 'Former Cabinet Secretary for Interior',
    orderIndex: 5,
    photoUrl: '/candidates/fred-matiangi.jpg',
    bio: "Fred Matiang'i served as Cabinet Secretary for Interior and Coordination of National Government from 2017 to 2022, having earlier held the Information and Communications Technology docket from 2013 and Education from 2015. He holds a bachelor’s degree from Kenyatta University and master’s and doctoral degrees from the University of Nairobi. He worked with the World Bank after leaving government.",
  },
  {
    slug: 'boniface-mwangi',
    fullName: 'Boniface Mwangi',
    party: 'Ukweli Party',
    role: 'Photojournalist and civic activist',
    orderIndex: 6,
    photoUrl: '/candidates/boniface-mwangi.jpg',
    bio: 'Boniface Mwangi is a Kenyan photojournalist who documented the 2007–2008 post-election period while working with The Standard Group. He trained in print journalism at the East African School of Journalism and later studied human rights and documentary photography at New York University. He founded the Pawa254 collective and the Courage Movement, and contested the Starehe parliamentary seat in 2017.',
  },
  {
    slug: 'david-maraga',
    fullName: 'David Maraga',
    party: 'United Green Movement',
    role: 'Former Chief Justice of Kenya',
    orderIndex: 7,
    photoUrl: '/candidates/david-maraga.jpg',
    bio: 'David Maraga served as Chief Justice of Kenya and President of the Supreme Court from 2016 until his retirement in 2021, presiding over the bench that annulled the August 2017 presidential election. He read law at the University of Nairobi and the Kenya School of Law, joined the judiciary as a magistrate in 1987, and sat as a High Court judge from 2003 and at the Court of Appeal from 2012.',
  },
]

async function main() {
  console.log('Seeding candidates…')

  for (const candidate of CANDIDATES) {
    // Upsert rather than create so re-running the seed is safe and never
    // duplicates or wipes accumulated votes.
    const record = await prisma.candidate.upsert({
      where: { slug: candidate.slug },
      update: {
        fullName: candidate.fullName,
        party: candidate.party,
        role: candidate.role,
        bio: candidate.bio,
        orderIndex: candidate.orderIndex,
        // Coalesced so that clearing a `photoUrl` in this file also clears it in
        // the database, rather than leaving a stale path behind.
        photoUrl: candidate.photoUrl ?? null,
      },
      create: candidate,
    })
    console.log(`  ✓ ${record.fullName}`)
  }

  const total = await prisma.candidate.count()
  console.log(`Done. ${total} candidates in the database.`)
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
