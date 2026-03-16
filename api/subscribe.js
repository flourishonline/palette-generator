export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { firstName, lastName, email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const AC_API_KEY = process.env.AC_API_KEY;
  const AC_API_URL = process.env.AC_API_URL; // e.g. https://youraccountname.api-us1.com
  const AC_LIST_ID = process.env.AC_LIST_ID; // numeric list ID from ActiveCampaign

  if (!AC_API_KEY || !AC_API_URL || !AC_LIST_ID) {
    console.error('Missing ActiveCampaign environment variables');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const baseUrl = AC_API_URL.replace(/\/$/, '');

  try {
    // Step 1 — Create or update the contact
    const contactRes = await fetch(`${baseUrl}/api/3/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Token': AC_API_KEY,
      },
      body: JSON.stringify({
        contact: {
          email,
          firstName: firstName || '',
          lastName: lastName || '',
        }
      })
    });

    if (!contactRes.ok) {
      const err = await contactRes.json();
      // AC returns 422 if contact already exists — handle gracefully
      if (contactRes.status !== 422) {
        throw new Error(err.message || 'Failed to create contact');
      }
    }

    const contactData = await contactRes.json();

    // Get contact ID — from new creation or from error response
    let contactId = contactData?.contact?.id;

    // If contact already exists (422), look them up by email
    if (!contactId) {
      const lookupRes = await fetch(
        `${baseUrl}/api/3/contacts?email=${encodeURIComponent(email)}`,
        { headers: { 'Api-Token': AC_API_KEY } }
      );
      const lookupData = await lookupRes.json();
      contactId = lookupData?.contacts?.[0]?.id;
    }

    if (!contactId) {
      throw new Error('Could not retrieve contact ID');
    }

    // Step 2 — Add contact to the list
    const listRes = await fetch(`${baseUrl}/api/3/contactLists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Token': AC_API_KEY,
      },
      body: JSON.stringify({
        contactList: {
          list: parseInt(AC_LIST_ID),
          contact: parseInt(contactId),
          status: 1 // 1 = subscribed
        }
      })
    });

    if (!listRes.ok) {
      const err = await listRes.json();
      throw new Error(err.message || 'Failed to add to list');
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('ActiveCampaign error:', error);
    return res.status(500).json({ error: 'Could not subscribe. Please try again.' });
  }
}
