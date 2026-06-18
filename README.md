# AGENDA LENA NEUROPSICÓLOGA

Agenda premium em React/Vite pronta para Vercel e Supabase.

## Novidades/correções desta versão
- Consultas recorrentes: semanal, quinzenal e mensal
- Geração automática por quantidade de sessões
- Editar recorrência: apenas esta, esta e próximas, ou toda a sequência
- Excluir recorrência: apenas esta, esta e próximas, ou toda a sequência
- Aviso de conflito de horário
- Botão de WhatsApp corrigido: usa telefone principal ou snapshot da consulta
- WhatsApp do paciente agora envia mensagem com o nome correto
- Calendário corrigido para 42 dias, evitando sumir fim de mês
- Próxima consulta não mostra horário já passado
- Edição de recorrência não joga todas as consultas para a mesma data
- SQL seguro de migração sem apagar dados: `supabase/migration_sem_apagar_dados.sql`
- Pagamentos pendentes
- Histórico melhor do paciente
- Status: aguardando confirmação e remarcada
- Supabase com schema resetado e colunas limpas

## Senha padrão
asd123

## Variáveis
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_PASSWORD=asd123

## Rodar local
npm install
npm run dev -- --host 0.0.0.0


## Importante sobre Supabase
Se você JÁ TEM pacientes/consultas cadastrados, rode primeiro o arquivo:

`supabase/migration_sem_apagar_dados.sql`

Não rode o `supabase/schema.sql` se não quiser apagar os dados, porque ele é um reset total.

## Ajuste de fluxo - pacientes e consultas

Nesta versão, o cadastro de paciente ficou separado da marcação de consulta. O botão "Cadastrar novo paciente" foi removido do modal de consulta para evitar confusão. O fluxo recomendado é:

1. Cadastrar o paciente na aba **Pacientes**.
2. Depois abrir a aba **Agenda** ou **Hoje** e marcar a consulta selecionando o paciente já cadastrado.
