$(document).ready(function () {
  // 1. Dynamic Student Type Control
  function updateStudentTypeUI() {
    const studentType = $('input[name="studentType"]:checked').val() || $('#studentTypeSelect').val();
    const regContainer = $('#registerNumberContainer');
    const regInput = $('#registerNumber');
    const emailHint = $('#emailHelpText');

    if (studentType === 'INTERNAL') {
      regContainer.slideDown(200);
      regInput.prop('required', true);
      $('#regNumberRequiredMark').show();
      emailHint.html('<span class="text-primary small"><i class="bi bi-info-circle"></i> Institutional domain required: <strong>@vitstudent.ac.in</strong></span>').show();
    } else if (studentType === 'EXTERNAL') {
      regContainer.slideUp(200);
      regInput.prop('required', false);
      regInput.val(''); // Clear value so it does not send invalid format
      regInput.removeClass('is-invalid');
      $('#regNumberRequiredMark').hide();
      emailHint.html('<span class="text-secondary small"><i class="bi bi-info-circle"></i> Personal email required (VIT emails blocked).</span>').show();
    }
  }

  // Bind change listeners
  $('input[name="studentType"]').on('change', updateStudentTypeUI);
  $('#studentTypeSelect').on('change', updateStudentTypeUI);
  updateStudentTypeUI(); // Initial invoke

  // 2. Clear invalid states and reset help text on typing
  $('input, select').on('input change', function () {
    $(this).removeClass('is-invalid');
    const fieldId = $(this).attr('id');
    if (fieldId) {
      $(`#${fieldId}Error`).text('').hide();
    }
    $(this).siblings('.invalid-feedback').text('').hide();
    if (fieldId === 'email') {
      $('#emailHelpText').show();
    }
    $('#otpStatusAlert').addClass('d-none').text('');
  });

  // Real-time username validator: letters only (no numbers, no special characters)
  $('#username, #newUsername').on('input', function () {
    const val = $(this).val();
    const errorEl = $(`#${$(this).attr('id')}Error`);
    if (val && !/^[a-zA-Z]+$/.test(val)) {
      $(this).addClass('is-invalid');
      errorEl.text('Username must contain only alphabetic letters (no numbers or special characters).').show();
    } else if (val && val.length > 0 && val.length < 3) {
      $(this).addClass('is-invalid');
      errorEl.text('Username must be at least 3 letters.').show();
    } else {
      $(this).removeClass('is-invalid');
      errorEl.text('').hide();
    }
  });

  // Real-time register number validator: 2 numbers, 3 alphabets, 4 numbers
  $('#registerNumber').on('input', function () {
    const studentType = $('input[name="studentType"]:checked').val() || $('#studentTypeSelect').val();
    if (studentType === 'INTERNAL') {
      const val = $(this).val().trim().toUpperCase();
      const errorEl = $('#registerNumberError');
      if (val && val.length > 0) {
        if (!/^[0-9]{2}[A-Z]{3}[0-9]{4}$/.test(val)) {
          errorEl.text('Format: 2 numbers, 3 alphabets, 4 numbers (e.g. 22BIT0061).').show();
        } else {
          $(this).removeClass('is-invalid');
          errorEl.text('').hide();
        }
      }
    }
  });

  // 3. Request OTP Handler
  $('#btnSendOtp').on('click', function () {
    const email = $('#email').val();
    const purpose = $(this).data('purpose') || 'REGISTRATION';
    const statusBox = $('#otpStatusAlert');

    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const studentType = $('input[name="studentType"]:checked').val() || $('#studentTypeSelect').val();

    if (!cleanEmail) {
      $('#email').addClass('is-invalid');
      $('#emailHelpText').hide();
      $('#emailError').text('Please enter your email address to receive an OTP.').show();
      statusBox.addClass('d-none');
      return;
    }

    // Pre-validate domain based on selected student type
    if (studentType === 'INTERNAL') {
      if (!cleanEmail.endsWith('@vitstudent.ac.in')) {
        $('#email').addClass('is-invalid');
        $('#emailHelpText').hide();
        $('#emailError').text('Internal students must use an email ending with @vitstudent.ac.in.').show();
        statusBox.addClass('d-none');
        return;
      }
    } else if (studentType === 'EXTERNAL') {
      if (cleanEmail.endsWith('@vitstudent.ac.in') || cleanEmail.endsWith('@vit.ac.in')) {
        $('#email').addClass('is-invalid');
        $('#emailHelpText').hide();
        $('#emailError').text('External students must use personal email. VIT domains are not allowed.').show();
        statusBox.addClass('d-none');
        return;
      }
    }

    const $btn = $(this);
    $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Sending OTP...');

    $.ajax({
      url: '/auth/send-otp',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ email: cleanEmail, purpose, studentType }),
      success: function (res) {
        $btn.prop('disabled', false).html('<i class="bi bi-send"></i> Resend OTP');
        statusBox.removeClass('alert-danger d-none').addClass('alert alert-success d-block');
        statusBox.html(`<strong>Success!</strong> ${res.message}`);
        if (res.devOtp) {
          $('#otp').val(res.devOtp); // Auto-fill in dev mode
        } else {
          $('#otp').val('').focus();
        }
      },
      error: function (xhr) {
        $btn.prop('disabled', false).html('<i class="bi bi-send"></i> Send OTP');
        statusBox.removeClass('alert-success d-none').addClass('alert alert-danger d-block');
        const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'Error sending OTP.';
        statusBox.html(`<strong>Error:</strong> ${msg}`);
      }
    });
  });

  // 4. Student Registration Form Submission
  $('#studentRegisterForm').on('submit', function (e) {
    e.preventDefault();
    const form = $(this);
    const alertBox = $('#formAlert');
    alertBox.addClass('d-none').text('');
    $('.is-invalid').removeClass('is-invalid');
    $('.invalid-feedback').text('');

    const formData = {
      studentType: $('input[name="studentType"]:checked').val() || $('#studentTypeSelect').val(),
      fullName: $('#fullName').val(),
      registerNumber: $('#registerNumber').val(),
      email: $('#email').val(),
      username: $('#username').val(),
      password: $('#password').val(),
      confirmPassword: $('#confirmPassword').val(),
      otp: $('#otp').val()
    };

    // Client-side format pre-checks
    if (formData.username && !/^[a-zA-Z]+$/.test(formData.username.trim())) {
      $('#username').addClass('is-invalid');
      $('#usernameError').text('Username must contain only alphabetic letters (no numbers or special characters).').show();
      return;
    }
    if (formData.studentType === 'INTERNAL' && formData.registerNumber && !/^[0-9]{2}[A-Z]{3}[0-9]{4}$/.test(formData.registerNumber.trim().toUpperCase())) {
      $('#registerNumber').addClass('is-invalid');
      $('#registerNumberError').text('Format must be 2 numbers, 3 alphabets, and 4 numbers (e.g. 22BIT0061).').show();
      return;
    }

    const submitBtn = form.find('button[type="submit"]');
    submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Registering...');

    $.ajax({
      url: '/auth/student-register',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(formData),
      success: function (res) {
        alertBox.removeClass('alert-danger d-none').addClass('alert alert-success d-block');
        alertBox.html(`<strong>Success!</strong> ${res.message}`);
        setTimeout(function () {
          window.location.href = res.redirectUrl || '/auth/login';
        }, 1500);
      },
      error: function (xhr) {
        submitBtn.prop('disabled', false).html('<i class="bi bi-person-plus-fill"></i> Complete Registration');
        const data = xhr.responseJSON;
        if (data && data.errors) {
          Object.keys(data.errors).forEach(function (field) {
            const input = $(`#${field}`);
            const feedback = $(`#${field}Error`);
            input.addClass('is-invalid');
            feedback.text(data.errors[field]).show();
            if (field === 'email') {
              $('#emailHelpText').hide();
            }
          });
        } else {
          alertBox.removeClass('alert-success d-none').addClass('alert alert-danger d-block');
          alertBox.text((data && data.message) || 'Registration failed. Please check the entered fields.');
        }
      }
    });
  });

  // 5. Faculty Registration Form Submission
  $('#facultyRegisterForm').on('submit', function (e) {
    e.preventDefault();
    const form = $(this);
    const alertBox = $('#formAlert');
    alertBox.addClass('d-none').text('');
    $('.is-invalid').removeClass('is-invalid');
    $('.invalid-feedback').text('');

    const formData = {
      fullName: $('#fullName').val(),
      employeeId: $('#employeeId').val(),
      email: $('#email').val(),
      username: $('#username').val(),
      password: $('#password').val(),
      confirmPassword: $('#confirmPassword').val(),
      facultyCapacity: $('#facultyCapacity').val()
    };

    if (formData.username && !/^[a-zA-Z]+$/.test(formData.username.trim())) {
      $('#username').addClass('is-invalid');
      $('#usernameError').text('Username must contain only alphabetic letters (no numbers or special characters).').show();
      return;
    }

    const submitBtn = form.find('button[type="submit"]');
    submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Registering Faculty...');

    $.ajax({
      url: '/auth/faculty-register',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(formData),
      success: function (res) {
        alertBox.removeClass('alert-danger d-none').addClass('alert alert-success d-block');
        alertBox.html(`<strong>Success!</strong> ${res.message}`);
        setTimeout(function () {
          window.location.href = res.redirectUrl || '/auth/login';
        }, 1500);
      },
      error: function (xhr) {
        submitBtn.prop('disabled', false).html('<i class="bi bi-person-badge-fill"></i> Complete Faculty Registration');
        const data = xhr.responseJSON;
        if (data && data.errors) {
          Object.keys(data.errors).forEach(function (field) {
            const input = $(`#${field}`);
            const feedback = $(`#${field}Error`);
            input.addClass('is-invalid');
            feedback.text(data.errors[field]);
          });
        } else {
          alertBox.removeClass('alert-success d-none').addClass('alert alert-danger d-block');
          alertBox.text((data && data.message) || 'Faculty registration failed.');
        }
      }
    });
  });

  // 6. Login Form Submission (Student & Faculty)
  $('#loginForm').on('submit', function (e) {
    e.preventDefault();
    const form = $(this);
    const alertBox = $('#loginAlert');
    alertBox.addClass('d-none').text('');
    $('.is-invalid').removeClass('is-invalid');

    const formData = {
      username: $('#username').val(),
      password: $('#password').val()
    };

    const submitBtn = form.find('button[type="submit"]');
    submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Signing In...');

    $.ajax({
      url: '/auth/login',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(formData),
      success: function (res) {
        alertBox.removeClass('alert-danger d-none').addClass('alert alert-success d-block');
        alertBox.html(`<strong>Authenticated!</strong> Redirecting to your dashboard...`);
        setTimeout(function () {
          window.location.href = res.redirectUrl || '/';
        }, 800);
      },
      error: function (xhr) {
        submitBtn.prop('disabled', false).html('<i class="bi bi-box-arrow-in-right"></i> Sign In');
        const data = xhr.responseJSON;
        alertBox.removeClass('alert-success d-none').addClass('alert alert-danger d-block');
        alertBox.text((data && data.message) || 'Invalid username or password.');
      }
    });
  });
});
