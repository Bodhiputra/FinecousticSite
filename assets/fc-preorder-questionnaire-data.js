window.FC_PREORDER_SURVEY = {
  reserve: [
    {
      id: 'r1',
      title: 'What was the main reason you decided to preorder Hako Nomad?',
      hint: 'Single choice',
      max: 1,
      options: [
        { letter: 'A', text: 'The design and appearance caught my attention' },
        { letter: 'B', text: 'The features/specifications matched what I was looking for' },
        { letter: 'C', text: 'The preorder offer and special pricing were attractive' },
        { letter: 'D', text: 'I was looking for a portable speaker for my lifestyle/use case' },
        { letter: 'E', text: 'I wanted to support a new audio brand' },
        { letter: 'F', text: 'Other', other: true }
      ]
    },
    {
      id: 'r2',
      title: 'Compared to other speakers you have seen, what makes Hako Nomad feel different?',
      hint: 'Choose 2 main answers',
      max: 2,
      options: [
        { letter: 'A', text: 'The design feels more unique and recognizable' },
        { letter: 'B', text: 'It feels more like a lifestyle product rather than just a speaker' },
        { letter: 'C', text: 'The overall product presentation feels more premium' },
        { letter: 'D', text: 'The features/specifications feel stronger' },
        { letter: 'E', text: 'The value feels better compared to alternatives' },
        { letter: 'F', text: "I don't see a major difference yet" },
        { letter: 'G', text: 'Other', other: true }
      ]
    },
    {
      id: 'r3',
      title: 'What would you like to see more from Finecoustic in the future?',
      hint: 'Choose 3 main answers',
      max: 3,
      options: [
        { letter: 'A', text: 'More portable speakers' },
        { letter: 'B', text: 'Desktop speakers' },
        { letter: 'C', text: 'Bookshelf speakers' },
        { letter: 'D', text: 'Headphones/headsets' },
        { letter: 'E', text: 'Earbuds' },
        { letter: 'G', text: 'Audio accessories' },
        { letter: 'H', text: 'Other', other: true }
      ]
    }
  ],
  decline: [
    {
      id: 'd1',
      title: 'What was the main reason you decided not to preorder?',
      hint: 'Choose one',
      max: 1,
      options: [
        { letter: 'A', text: 'I need more information before deciding' },
        { letter: 'B', text: 'I want to compare with other speakers first' },
        { letter: 'C', text: 'The price/value does not meet my expectation' },
        { letter: 'D', text: 'I am unsure about the sound quality' },
        { letter: 'E', text: 'I am unsure about Finecoustic as a new brand' },
        { letter: 'F', text: 'The design does not match my preference' },
        { letter: 'G', text: 'I do not need a speaker currently' },
        { letter: 'H', text: 'Other', other: true }
      ]
    },
    {
      id: 'd2',
      title: "How would you rate Hako Nomad's design?",
      hint: 'Choose one',
      max: 1,
      options: [
        { letter: 'A', text: '1 — Not appealing' },
        { letter: 'B', text: '2 — Slightly appealing' },
        { letter: 'C', text: '3 — Neutral' },
        { letter: 'D', text: '4 — Attractive' },
        { letter: 'E', text: '5 — Very attractive' }
      ]
    },
    {
      id: 'd3',
      title: 'Which statement best describes your hesitation?',
      hint: 'Choose one',
      max: 1,
      options: [
        { letter: 'A', text: 'I like the design, but I am not sure the sound quality is good enough' },
        { letter: 'B', text: "I like the product, but I don't see enough difference compared to existing speakers" },
        { letter: 'C', text: "I like the product, but I don't know enough about Finecoustic yet" },
        { letter: 'D', text: 'I like the product, but the price feels high compared to alternatives' },
        { letter: 'E', text: 'I am interested, but I am not ready to buy a speaker now' },
        { letter: 'F', text: 'None of the above' },
        { letter: 'G', text: 'Other', other: true }
      ]
    },
    {
      id: 'd4',
      title: 'What information would help you feel more confident purchasing Hako Nomad?',
      hint: 'Choose 3 main answers',
      max: 3,
      options: [
        { letter: 'A', text: 'Sound demonstration videos' },
        { letter: 'B', text: 'Real-life usage/lifestyle videos' },
        { letter: 'C', text: 'Reviews from creators or users' },
        { letter: 'D', text: 'More product photos/videos' },
        { letter: 'E', text: 'More details about features and specifications' },
        { letter: 'G', text: 'More information about Finecoustic as a brand' },
        { letter: 'H', text: 'Nothing, I already have enough information' },
        { letter: 'I', text: 'Other', other: true }
      ]
    },
    {
      id: 'd5',
      title: 'When choosing an audio product, what matters most to you?',
      hint: 'Choose 3 main answers',
      max: 3,
      options: [
        { letter: 'A', text: 'Sound quality' },
        { letter: 'B', text: 'Design and aesthetics' },
        { letter: 'C', text: 'Brand reputation' },
        { letter: 'D', text: 'Features and connectivity' },
        { letter: 'E', text: 'Price/value' },
        { letter: 'G', text: 'Build quality/materials' },
        { letter: 'H', text: 'Unique identity/personality' }
      ]
    }
  ]
};
