import { HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata = {
  title: "FAQ - FrumToronto",
  description: "Frequently asked questions about FrumToronto.com",
};

const faqs = [
  {
    category: "Account & Login",
    questions: [
      {
        q: "Is a log on required to view the site?",
        a: "The log on enables the members to post articles to the blogger, add events to the community calendar, add listings to the classified section and more. We require the password to moderate the content added to the site. Once logged on, members can post new articles and comment on existing ones. The log on is not required to view the site.",
      },
      {
        q: "How do I get my log on and password?",
        a: "From the home page, click on \"Become a Member\" or \"Register\". A form will appear prompting for your name, e-mail address, etc. Your password will be sent to you by e-mail.",
      },
      {
        q: "I received my password through e-mail. Is there any way to change it to something easier for me to remember?",
        a: "Once you're logged on you can change your password by clicking \"Change Your Password\" in your account settings.",
      },
      {
        q: "What if I forget my password?",
        a: "From the home page, click on \"Forgot Your Password\" in the log on window. The registration page opens up with options for resending you your password. The password will be sent to your email.",
      },
    ],
  },
  {
    category: "Posting Content",
    questions: [
      {
        q: "I don't have my password yet. Is there any way for me to add to the blogger without logging on?",
        a: "You can contact us to post your message to the blogger for you. When members post articles or events, they have the advantage of editing their own post. If an event is changed, postponed or canceled, just log on and edit the event!",
      },
      {
        q: "I logged on and I'm currently in the blogger window. How do I post a new add or comment?",
        a: "New blog entries can be submitted by clicking on \"Add New Blog Articles\" in your account menu. Comments can be added by expanding the blog article. The add comments box is located under the blog article.",
      },
      {
        q: "How do I add an event to the community calendar?",
        a: "From the community calendar, click the button \"Add Event\". It's important to send us the information as soon as it's available so others planning an event can schedule around you. Likewise, we recommend everyone check the community calendar prior to making a Simcha or any other community program.",
      },
    ],
  },
  {
    category: "Business Directory",
    questions: [
      {
        q: "How do I get my business listed on the site and what is the cost?",
        a: "There are several methods to apply to be listed in the business directory. From the home page, you can click on the \"Add your Business!\" button and fill in the online form. Alternately, you can email us to request a meeting. We are currently offering the basic listing at no charge. Contact us for rates on the full listing or to get more information.",
      },
      {
        q: "I'm logged on but can't add to the weekly specials page.",
        a: "Only businesses can add specials to the weekly special section. The Company name will automatically be added to the special and it will link to their listing and flyer.",
      },
    ],
  },
  {
    category: "Classifieds",
    questions: [
      {
        q: "How do I use the classified section of the site?",
        a: "You must be logged on to the site to submit or respond to articles in the classified section. Once logged on, members can submit their ads. No private information is needed. Members can then respond to the ad with their contact information. Only the original submitter of the ad can view the response.",
      },
      {
        q: "It says there are 2 responses to my classified ad. How do I view them?",
        a: "Once logged on you can view the responses in your account dashboard under your classified listings.",
      },
    ],
  },
  {
    category: "Newsletter & Updates",
    questions: [
      {
        q: "I don't have full access to the internet from home. Is there a way for me to keep in touch with community events and Simchas through e-mail?",
        a: "Yes. You can subscribe to our newsletter and receive e-mails on upcoming events and notifications on Kashruth alerts, engagements and other related announcements.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-16 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex p-3 bg-white/10 rounded-2xl mb-6">
              <HelpCircle className="h-8 w-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-blue-100">
              Find answers to common questions about using FrumToronto
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {faqs.map((section) => (
            <div key={section.category} className="space-y-5">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <span className="w-1.5 h-8 bg-blue-600 rounded-full"></span>
                {section.category}
              </h2>
              <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                <Accordion type="single" collapsible className="w-full">
                  {section.questions.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`${section.category}-${index}`}
                      className="border-b border-gray-200 last:border-0"
                    >
                      <AccordionTrigger className="px-6 py-5 text-left hover:bg-white hover:no-underline text-base">
                        <span className="font-medium text-gray-900 pr-4">{faq.q}</span>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-5 text-gray-600 text-base leading-relaxed bg-white">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="max-w-2xl mx-auto mt-16">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 text-center border border-blue-200">
            <h3 className="text-2xl font-bold text-blue-900 mb-3">
              Still have questions?
            </h3>
            <p className="text-blue-700 mb-6">
              Can&apos;t find what you&apos;re looking for? We&apos;re here to help.
            </p>
            <a
              href="/contact"
              className="inline-flex px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
            >
              Contact Us
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
