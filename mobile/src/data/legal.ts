// In-app copies of the Terms of Service and Privacy Policy.
//
// DRAFT. Not reviewed by a lawyer. PRD 7.8 is explicit that the
// assumption-of-risk and limitation-of-liability language must be reviewed by
// an actual attorney before public launch, and that is still outstanding. This
// covers the ground that matters and is written to be read, not to be
// impenetrable, but do not ship it as-is.
//
// The same text lives in legal/TERMS.md and legal/PRIVACY.md for the public
// web pages, which App Review requires you to link.

export const LEGAL_VERSION = '2026-07-28';
export const CONTACT_EMAIL = 'support@frame.game';

export interface Section {
  heading: string;
  body: string[];
}

export interface Doc {
  title: string;
  updated: string;
  intro: string;
  sections: Section[];
}

export const TERMS: Doc = {
  title: 'Terms of Service',
  updated: LEGAL_VERSION,
  intro:
    'Hidewire is a game you play by walking around real places with real people in them. These terms exist mostly to be clear about what that means and who is responsible for what.',
  sections: [
    {
      heading: '1. Who can use Hidewire',
      body: [
        'You must be 13 or older. We ask for your date of birth once, and if you are under 13 we refuse the account and remember that refusal on the device.',
        'If you are between 13 and 17, you get non-personalised advertising only, and we do not ask you to allow tracking.',
        'Hidewire is available in the United States only for now.',
      ],
    },
    {
      heading: '2. You are responsible for where you go',
      body: [
        'This is the important one. Hidewire shows you places and gives you reasons to walk to them. It does not know whether the route is safe, whether the property is public, or what is happening at that location right now. You do.',
        'You agree to stay on public property, obey the law, keep away from traffic, and stop playing the moment anyone with authority over a place asks you to.',
        'You accept the risks that come with moving around in the physical world, including injury, and you accept them for yourself rather than for us. If you would not do it without the game, do not do it because of the game.',
        'Do not play while driving. The app suspends itself above 10 mph, but that is a backstop and not a permission slip.',
      ],
    },
    {
      heading: '3. Photos',
      body: [
        'The game requires you to photograph where you are hiding. Those photos go to the seeker in your party, and to spectators if the host enabled that.',
        'Do not photograph other people deliberately, do not photograph inside private spaces, and do not submit anything you would be uncomfortable having a friend see.',
        'Photos are deleted permanently 24 hours after a round ends. They are not kept in your match history and they are not used to train anything.',
        'You keep ownership of your photos. You give us permission to store and show them to your party for the duration described above, and nothing beyond that.',
      ],
    },
    {
      heading: '4. Fair play',
      body: [
        'Do not fake your location, modify the app, or submit photos you did not just take. We check for these and the checks are not advisory.',
        'Accounts caught cheating lose their progress for the affected rounds and may be removed.',
      ],
    },
    {
      heading: '5. Purchases',
      body: [
        'Anything you buy is cosmetic or currency spendable on cosmetics. Nothing purchasable changes the outcome of a round. This is deliberate: in a game played with real bodies in real places, a purchasable advantage would be an incentive to take a real risk.',
        'Purchases are handled by Apple or Google under their refund terms, not ours.',
        'Any real-money purchase disables advertising on your account permanently.',
      ],
    },
    {
      heading: '6. Content and conduct',
      body: [
        'Every photo and every player can be reported from inside the app. Reports are reviewed within 24 hours.',
        'You can block another player, and a blocked player cannot join a party you are in.',
        'Harassment, sexual content, and content involving minors are grounds for immediate removal and, where applicable, a report to authorities.',
      ],
    },
    {
      heading: '7. Limitation of liability',
      body: [
        'Hidewire is provided as-is. To the maximum extent the law allows, we are not liable for indirect or consequential damages, and our total liability is limited to what you have paid us in the last twelve months.',
        'Nothing here limits liability that cannot be limited by law, including for death or personal injury caused by negligence on our part.',
        'This section in particular has not yet been reviewed by a lawyer and will change before public launch.',
      ],
    },
    {
      heading: '8. Changes and contact',
      body: [
        'If these terms change in a way that matters, you will be asked to accept them again.',
        `Questions go to ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

export const PRIVACY: Doc = {
  title: 'Privacy Policy',
  updated: LEGAL_VERSION,
  intro:
    'The short version: we collect the least we can get away with, your position is not shared with the seeker except at reveal ticks, and your photos are deleted a day after the round.',
  sections: [
    {
      heading: 'What we collect',
      body: [
        'Account: your date of birth, a handle you choose, and if you sign in with Google or Apple, the email address they give us. Guests get a device-local account and we collect no email at all.',
        'Location: your coordinates while a round is running. Between reveal ticks these stay on the server and are never sent to the seeker. We sample coarsely, roughly 100 metres, except in the few seconds around a tick.',
        'Photos: the two images per check-in, plus the numeric quality scores and a perceptual hash used to detect reuse.',
        'Gameplay: rounds played, outcomes, XP, and the stats shown on your profile.',
      ],
    },
    {
      heading: 'What we do not collect',
      body: [
        'We do not run face detection, facial recognition, face landmarking, or any biometric processing on your photos, ever. The validity checks operate on whole-image statistics such as brightness, blur, and edge density. Nothing in the pipeline can produce an identifier for a person.',
        'We do not ask for gallery access. The camera is live-capture only.',
        'We do not record audio.',
        'We do not sell your data, and we do not share it with data brokers.',
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        'Photos: deleted permanently 24 hours after the round ends, by a scheduled job that writes an audit record for each deletion.',
        'Positions: purged when the round ends.',
        'Match results and stats: 90 days.',
        'Account: until you delete it. Deleting the account removes everything associated with it.',
      ],
    },
    {
      heading: 'Players aged 13 to 17',
      body: [
        'Accounts whose stored date of birth places the user under 18 receive non-personalised, contextual advertising only. This is enforced on the server, not in the app.',
        'We do not show the App Tracking Transparency prompt to these accounts and we do not collect behavioural analytics from them beyond what is needed to run the product.',
      ],
    },
    {
      heading: 'Who we share with',
      body: [
        'Other players in your party, and only what the game requires: your handle, your check-in photos while the round runs, and your position at reveal ticks.',
        'Service providers who host the database, storage, crash reporting, and advertising. They act on our instructions.',
        'Law enforcement, where we are legally required to.',
      ],
    },
    {
      heading: 'Your choices',
      body: [
        'You can revoke location or camera permission at any time in your device settings. The game will not work without them, but that is your call to make.',
        'You can delete your account from the app, and you can request a copy of your data.',
        'You can report a POI that should not be in the game. Reported locations are reviewed and removed within 15 days if the report is valid.',
      ],
    },
    {
      heading: 'Contact',
      body: [`Privacy questions go to ${CONTACT_EMAIL}.`],
    },
  ],
};
