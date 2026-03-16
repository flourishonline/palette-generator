export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { firstName, lastName, email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const AC_API_KEY  = process.env.AC_API_KEY;
  const AC_API_URL  = process.env.AC_API_URL;
  const AC_TAG_NAME = process.env.AC_TAG_NAME; // e.g. "Palette Generator Lead"

  if (!AC_API_KEY || !AC_API_URL || !AC_TAG_NAME) {
    console.error('Missing ActiveCampaign environment variables');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const baseUrl = AC_API_URL.replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json', 'Api-Token': AC_API_KEY };

  try {
    // ── STEP 1: Create or update contact ──────────────────
    const contactRes = await fetch(`${baseUrl}/api/3/contacts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contact: { email, firstName: firstName || '', lastName: lastName || '' }
      })
    });

    const contactData = await contactRes.json();
    let contactId = contactData?.contact?.id;

    // 422 = contact already exists — look them up by email
    if (!contactId) {
      const lookupRes = await fetch(
        `${baseUrl}/api/3/contacts?email=${encodeURIComponent(email)}`,
        { headers }
      );
      const lookupData = await lookupRes.json();
      contactId = lookupData?.contacts?.[0]?.id;
    }

    if (!contactId) throw new Error('Could not retrieve contact ID');

    // ── STEP 2: Find tag by name ───────────────────────────
    const tagSearchRes = await fetch(
      `${baseUrl}/api/3/tags?search=${encodeURIComponent(AC_TAG_NAME)}`,
      { headers }
    );
    const tagSearchData = await tagSearchRes.json();
    let tagId = tagSearchData?.tags?.find(
      t => t.tag.toLowerCase() === AC_TAG_NAME.toLowerCase()
    )?.id;

    // ── STEP 3: If tag doesn't exist yet, create it ────────
    if (!tagId) {
      const createTagRes = await fetch(`${baseUrl}/api/3/tags`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tag: { tag: AC_TAG_NAME, tagType: 'contact' } })
      });
      const createTagData = await createTagRes.json();
      tagId = createTagData?.tag?.id;
    }

    if (!tagId) throw new Error('Could not find or create tag');

    // ── STEP 4: Apply tag to contact ──────────────────────
    await fetch(`${baseUrl}/api/3/contactTags`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contactTag: { contact: parseInt(contactId), tag: parseInt(tagId) }
      })
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('ActiveCampaign error:', error);
    return res.status(500).json({ error: 'Could not subscribe. Please try again.' });
  }
}
