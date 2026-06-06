import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BottomNavigationComponent } from '../../components/bottom-navigation/bottom-navigation.component';
import { MedicationService, Medication } from '../../services/medication.service';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  message: string;
  timestamp: Date;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, BottomNavigationComponent],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.css'
})
export class ChatbotPageComponent {
  messages: ChatMessage[] = [];
  userInput = '';
  isLoading = false;
  userMedications: Medication[] = [];

  suggestedQuestions = [
    'What medications am I taking?',
    'What are the side effects of my meds?',
    'Remind me how to take my medicine',
    'What should I do if I miss a dose?'
  ];

  constructor(private medicationService: MedicationService) {
    this.initializeChat();
    this.loadUserMedications();
  }

  loadUserMedications() {
    this.medicationService.medications$.subscribe(meds => {
      this.userMedications = meds;
    });
  }

  initializeChat() {
    this.messages = [
      {
        id: '1',
        sender: 'ai',
        message: 'Hello! I\'m your DoseGuard AI assistant. I can help you with information about your medications, dosages, side effects, and general health questions. How can I assist you today?',
        timestamp: new Date()
      }
    ];
  }

  sendMessage() {
    if (!this.userInput.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      message: this.userInput,
      timestamp: new Date()
    };
    this.messages.push(userMessage);

    // Simulate AI response
    this.isLoading = true;
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        message: this.generateAIResponse(this.userInput),
        timestamp: new Date()
      };
      this.messages.push(aiResponse);
      this.isLoading = false;
      this.userInput = '';
    }, 1000);
  }

  askQuestion(question: string) {
    this.userInput = question;
    setTimeout(() => this.sendMessage(), 100);
  }

  private generateAIResponse(userMessage: string): string {
    const input = userMessage.toLowerCase();
    
    // Check if asking about current medications
    if (input.includes('what medications') || input.includes('my medications') || input.includes('my meds')) {
      if (this.userMedications.length === 0) {
        return "You haven't added any medications to your DoseGuard schedule yet. You can add one by clicking the '+' icon on the dashboard.";
      }
      const medList = this.userMedications.map(m => m.name).join(', ');
      return `Currently, you are taking: ${medList}. Is there a specific one you'd like to know more about?`;
    }

    // Check if asking about side effects
    if (input.includes('side effects')) {
      // Check if they mentioned a specific medication they have
      const mentionedMed = this.userMedications.find(m => input.includes(m.name.toLowerCase()));
      if (mentionedMed) {
        return `For ${mentionedMed.name}, common side effects can include mild dizziness or nausea. Please refer to your doctor or the medication pamphlet for a complete list. Is there anything else about ${mentionedMed.name} you'd like to know?`;
      }
      return 'Common side effects vary by medication. Generally, you should watch out for rashes, dizziness, or stomach upset. Which specific medication are you asking about?';
    }

    // Check for dosage/how to take
    if (input.includes('how to take') || input.includes('dosage') || input.includes('remind me')) {
      const mentionedMed = this.userMedications.find(m => input.includes(m.name.toLowerCase()));
      if (mentionedMed) {
        return `You are scheduled to take ${mentionedMed.name} (${mentionedMed.dosage}) ${mentionedMed.frequency}. Make sure to take it at your scheduled times to maintain its effectiveness.`;
      }
      return 'You should follow the dosage instructions provided by your doctor. Your DoseGuard app will send you notifications when it\'s time for each dose. Do you have a question about a specific medication in your list?';
    }

    if (input.includes('miss a dose') || input.includes('missed')) {
      return 'If you miss a dose, take it as soon as you remember. However, if it\'s almost time for your next dose, skip the missed one. Never take a double dose. Would you like me to check your recent adherence?';
    }

    const generalResponses: { [key: string]: string } = {
      'hello': 'Hello! How can I help you with your health and medications today?',
      'hi': 'Hi there! I\'m your DoseGuard assistant. What can I do for you?',
      'thanks': 'You\'re very welcome! I\'m here if you need anything else.',
      'thank you': 'No problem at all. Stay healthy!',
      'vitamins': 'Vitamins are great supplements! Most are best taken with food for better absorption. Are you taking any specific vitamins?'
    };

    for (const [key, value] of Object.entries(generalResponses)) {
      if (input.includes(key)) {
        return value;
      }
    }

    return 'I\'m sorry, I didn\'t quite get that. I can help you with your medication list, dosages, side effects, and general health tips. Could you please rephrase your question?';
  }
}
